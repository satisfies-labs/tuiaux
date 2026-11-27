import { Duration, Effect, Layer, Option } from "effect"
import {
  FetchHttpClient,
  Headers,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  UrlParams,
} from "effect/http"

const TIMEOUT = Duration.seconds(15)

/** shortcut: drops the oldest entry past this size, upgrade to an LRU if long sessions show misses. */
const MAX_ETAGS = 500

interface Cached {
  readonly etag: string
  readonly body: string
}

/** Only GETs: a POST (GraphQL) carries its query in the body, so its URL alone says nothing. */
const isGet = (request: HttpClientRequest.HttpClientRequest) =>
  request.method === "GET"

const keyOf = (request: HttpClientRequest.HttpClientRequest) =>
  `${request.url}?${UrlParams.toString(request.urlParams)}`

/** A fresh 200 response carrying `body`, so it can be read again by whoever decodes it. */
const replay = (
  response: HttpClientResponse.HttpClientResponse,
  body: string,
) =>
  HttpClientResponse.fromWeb(
    response.request,
    new Response(body, { status: 200, headers: response.headers }),
  )

/**
 * Remembers the body of every 200 that has an ETag, sends `If-None-Match` next time, and answers a 304
 * with the remembered body as a 200. Unchanged polls then cost nothing (GitHub doesn't count 304s).
 */
export const withEtagCache = (
  client: HttpClient.HttpClient,
): HttpClient.HttpClient => {
  const cache = new Map<string, Cached>()

  const remember = (key: string, cached: Cached) => {
    cache.delete(key)
    cache.set(key, cached)
    const oldest = cache.keys().next()

    if (cache.size > MAX_ETAGS && oldest.done !== true)
      cache.delete(oldest.value)
  }

  return client.pipe(
    HttpClient.mapRequest(request => {
      const cached = isGet(request) ? cache.get(keyOf(request)) : undefined

      return cached === undefined
        ? request
        : HttpClientRequest.setHeader(request, "if-none-match", cached.etag)
    }),
    HttpClient.transformResponse(
      Effect.flatMap(response => {
        if (!isGet(response.request)) return Effect.succeed(response)

        const key = keyOf(response.request)
        const cached = cache.get(key)
        const etag = Headers.get(response.headers, "etag")

        if (response.status === 304 && cached !== undefined)
          return Effect.succeed(replay(response, cached.body))

        if (response.status !== 200 || Option.isNone(etag))
          return Effect.succeed(response)

        return response.text.pipe(
          Effect.tap(body =>
            Effect.sync(() => remember(key, { etag: etag.value, body })),
          ),
          Effect.map(body => replay(response, body)),
        )
      }),
    ),
  )
}

/**
 * The app's `HttpClient`: fetch, a user agent, a 15 s timeout and the ETag cache.
 * No retries here: the retry policy belongs to `Monitor`.
 */
export const HttpLive: Layer.Layer<HttpClient.HttpClient> = Layer.effect(
  HttpClient.HttpClient,
  HttpClient.HttpClient.pipe(
    Effect.map(client =>
      withEtagCache(
        client.pipe(
          HttpClient.mapRequest(
            HttpClientRequest.setHeader("user-agent", "tuiaux"),
          ),
          HttpClient.timeout(TIMEOUT),
        ),
      ),
    ),
  ),
).pipe(Layer.provide(FetchHttpClient.layer))
