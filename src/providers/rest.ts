import {
  Cache,
  Clock,
  Data,
  Duration,
  Effect,
  Exit,
  Option,
  Predicate,
  Result,
  type Schema,
} from "effect"
import {
  Headers,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpIncomingMessage,
  type UrlParams,
} from "effect/http"

import {
  Network,
  NotFound,
  type ProviderError,
  type ProviderKind,
  RateLimited,
  type RepoRef,
  type RunRef,
  Unauthorized,
  Unexpected,
} from "../domain"
import { cliCredentials } from "./credentials"

/** What a REST provider declares. Everything else (auth, status handling, decoding) is shared. */
export interface RestSpec {
  readonly kind: ProviderKind
  readonly host: string
  readonly baseUrl: string
  /** Sent with every request (accept, API version). */
  readonly headers: Readonly<Record<string, string>>
  /** The CLI that holds the token. */
  readonly cli: {
    readonly command: string
    readonly args: ReadonlyArray<string>
    /** Login command shown in hints: `gh auth login`. */
    readonly login: string
    /** Where to get the CLI. */
    readonly install: string
  }
  /** Header holding the epoch second at which the quota resets. */
  readonly rateLimitResetHeader: string
  /** Whether a 403 means "quota spent" (GitHub) rather than "no access". */
  readonly isRateLimit403: (
    response: HttpClientResponse.HttpClientResponse,
  ) => boolean
  /** Shown when a 403 means the token lacks access (scope, SSO). */
  readonly forbiddenHint: string
}

/** What a call is about, so a 404 names the missing resource. */
export interface Target {
  readonly repo: RepoRef
  readonly resource: NotFound["resource"]
}

/** Used when a host says "slow down" without saying for how long. */
const DEFAULT_BACKOFF = Duration.minutes(1)

/**
 * When a rate-limited host can be called again: its epoch-seconds reset header, else `Retry-After`
 * (seconds or HTTP date, parsed by Effect), else a minute from `now`.
 */
export const resetAt = (
  headers: Headers.Headers,
  resetHeader: string,
  now: number,
): Date =>
  Headers.get(headers, resetHeader).pipe(
    Option.map(Number),
    Option.filter(Number.isSafeInteger),
    Option.map(epoch => new Date(epoch * 1000)),
    Option.orElse(() =>
      Headers.get(headers, "retry-after").pipe(
        Option.flatMap(value =>
          Result.getSuccess(Headers.parseRetryAfter(value)),
        ),
        Option.map(retryAfter => Headers.retryAfterDelay(retryAfter, now)),
        Option.map(delay => new Date(now + Duration.toMillis(delay))),
      ),
    ),
    Option.getOrElse(() => new Date(now + Duration.toMillis(DEFAULT_BACKOFF))),
  )

/**
 * A REST API client for one provider: authenticated GETs whose every failure is a `ProviderError`.
 * No token → AuthMissing · no answer → Network · 401/403 → Unauthorized (the token is dropped so the
 * next call asks the CLI again) · quota → RateLimited · 404 → NotFound · anything else → Unexpected.
 */
export const restClient = Effect.fn("Rest.client")(function* (spec: RestSpec) {
  const origin = { kind: spec.kind, host: spec.host }

  const credentials = yield* cliCredentials({
    ...origin,
    command: spec.cli.command,
    args: spec.cli.args,
    loginHint: `Run \`${spec.cli.login}\`.`,
    installHint: `Install the CLI (${spec.cli.install}), then run \`${spec.cli.login}\`.`,
  })

  const http = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(request =>
      request.pipe(
        HttpClientRequest.prependUrl(spec.baseUrl),
        HttpClientRequest.setHeaders(spec.headers),
      ),
    ),
  )

  const unauthorized = (hint: string) =>
    credentials.invalidate.pipe(
      Effect.andThen(Effect.fail(new Unauthorized({ ...origin, hint }))),
    )

  const rateLimited = (response: HttpClientResponse.HttpClientResponse) =>
    Clock.currentTimeMillis.pipe(
      Effect.flatMap(now =>
        Effect.fail(
          new RateLimited({
            ...origin,
            resetAt: resetAt(response.headers, spec.rateLimitResetHeader, now),
          }),
        ),
      ),
    )

  // The error body (GitHub/GitLab put a message there) goes into the cause, for the log.
  const unexpected = (response: HttpClientResponse.HttpClientResponse) =>
    response.text.pipe(
      Effect.orElseSucceed(() => ""),
      Effect.flatMap(body =>
        Effect.fail(
          new Unexpected({ ...origin, status: response.status, cause: body }),
        ),
      ),
    )

  /** Sends one authenticated request and turns the answer into a decoded value or a `ProviderError`. */
  const send = Effect.fn("Rest.send")(function* <
    S extends Schema.Constraint & { readonly DecodingServices: never },
  >(schema: S, request: HttpClientRequest.HttpClientRequest, target: Target) {
    const token = yield* credentials.token

    const response = yield* http
      .execute(HttpClientRequest.bearerToken(request, token))
      .pipe(Effect.mapError(cause => new Network({ ...origin, cause })))

    return yield* HttpClientResponse.matchStatus(response, {
      "2xx": () =>
        HttpIncomingMessage.schemaBodyJson(schema)(response).pipe(
          Effect.mapError(
            // The answer was fine but unusable: no status, per `Unexpected`'s contract.
            cause => new Unexpected({ ...origin, status: undefined, cause }),
          ),
        ),
      401: () =>
        unauthorized(`The token was rejected: run \`${spec.cli.login}\`.`),
      403: forbidden =>
        spec.isRateLimit403(forbidden)
          ? rateLimited(forbidden)
          : unauthorized(spec.forbiddenHint),
      404: () => Effect.fail(new NotFound(target)),
      429: rateLimited,
      orElse: unexpected,
    })
  })

  return {
    get: <S extends Schema.Constraint & { readonly DecodingServices: never }>(
      schema: S,
      path: string,
      params: UrlParams.Input,
      target: Target,
    ) =>
      send(schema, HttpClientRequest.get(path, { urlParams: params }), target),

    /** A JSON POST, e.g. a GraphQL query: one request for what REST would need many for. */
    post: <S extends Schema.Constraint & { readonly DecodingServices: never }>(
      schema: S,
      path: string,
      body: Schema.Json,
      target: Target,
    ) =>
      send(
        schema,
        HttpClientRequest.post(path).pipe(
          HttpClientRequest.bodyJsonUnsafe(body),
        ),
        target,
      ),
  }
})

/** Credentials or quota problems: they affect the whole host, never only one lookup. */
const isHostWide = (error: ProviderError): boolean =>
  Predicate.isTagged(error, "AuthMissing") ||
  Predicate.isTagged(error, "Unauthorized") ||
  Predicate.isTagged(error, "RateLimited")

/** A run as last modified. Details cached per revision are fetched again after a re-run. */
export class RunRevision extends Data.Class<{
  readonly run: RunRef
  /** The run's `updated_at`: useless as an end time, but it changes whenever the run does. */
  readonly updatedAt: number
}> {}

/**
 * Looks up what can't change for a key (a settled run's real times for one revision, a commit's
 * title) once, and keeps it. A failure isn't kept, so the next poll asks again; meanwhile a local
 * failure (not found, network) reads as None, and a host-wide one (rate limit, credentials) fails.
 */
export const cachedLookup = Effect.fn("Rest.cachedLookup")(function* <K, A>(
  lookup: (key: K) => Effect.Effect<A, ProviderError>,
) {
  const cache = yield* Cache.makeWith(lookup, {
    capacity: 1024,
    timeToLive: Exit.match({
      onFailure: () => Duration.zero,
      onSuccess: () => Duration.infinity,
    }),
  })

  // Host-wide errors still fail, so the Monitor pauses the host instead of polling on.
  return (key: K) =>
    Cache.get(cache, key).pipe(
      Effect.map(Option.some),
      Effect.catchIf(
        error => !isHostWide(error),
        () => Effect.succeedNone,
      ),
    )
})
