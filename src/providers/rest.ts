import { Clock, Duration, Effect, Option, Result, type Schema } from "effect"
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
  type ProviderKind,
  RateLimited,
  type RepoRef,
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

  const get = Effect.fn("Rest.get")(function* <
    S extends Schema.Constraint & { readonly DecodingServices: never },
  >(schema: S, path: string, params: UrlParams.Input, target: Target) {
    const token = yield* credentials.token

    const response = yield* http
      .execute(
        HttpClientRequest.get(path, { urlParams: params }).pipe(
          HttpClientRequest.bearerToken(token),
        ),
      )
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

  return { get }
})
