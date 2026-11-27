import { Effect, Layer, Option, type Schema } from "effect"
import {
  Headers,
  HttpBody,
  HttpClient,
  HttpClientError,
  type HttpClientRequest,
  HttpClientResponse,
  UrlParams,
} from "effect/http"

/** A canned answer, or no answer at all. */
export type FakeReply =
  | {
      readonly status: number
      /** Sent as JSON. */
      readonly body?: Schema.Json
      readonly headers?: Readonly<Record<string, string>>
    }
  | "unreachable"

/** What a request looked like, in plain values for assertions. */
export interface SentRequest {
  readonly method: string
  readonly url: string
  /** The JSON body, for POSTs. */
  readonly body: Schema.Json | undefined
  readonly params: Readonly<Record<string, string>>
  readonly header: (name: string) => string | undefined
}

const jsonBody = (body: HttpBody.HttpBody): Schema.Json | undefined =>
  body instanceof HttpBody.Uint8Array
    ? JSON.parse(new TextDecoder().decode(body.body))
    : undefined

const toSent = (request: HttpClientRequest.HttpClientRequest): SentRequest => ({
  method: request.method,
  url: request.url,
  body: jsonBody(request.body),
  params: Object.fromEntries(
    new URLSearchParams(UrlParams.toString(request.urlParams)),
  ),
  header: name => Option.getOrUndefined(Headers.get(request.headers, name)),
})

const bodyOf = (body: Schema.Json | undefined) =>
  body === undefined ? null : JSON.stringify(body)

/** An `HttpClient` that answers with `route(request)` and records every request it was sent. */
export const fakeHttpClient = (route: (request: SentRequest) => FakeReply) => {
  const sent: Array<SentRequest> = []

  const client = HttpClient.make(request =>
    Effect.suspend(() => {
      const plain = toSent(request)

      sent.push(plain)
      const reply = route(plain)

      if (reply === "unreachable")
        return Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request }),
          }),
        )

      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(bodyOf(reply.body), {
            status: reply.status,
            headers: reply.headers ?? {},
          }),
        ),
      )
    }),
  )

  return { sent, client, layer: Layer.succeed(HttpClient.HttpClient, client) }
}
