import { expect } from "bun:test"
import { Effect } from "effect"
import { HttpClientRequest } from "effect/http"

import { withEtagCache } from "../../src/platform"
import { type FakeReply, fakeHttpClient } from "../fakes/http-client"
import { it } from "../support/effect"

const request = HttpClientRequest.get("https://api.example.com/runs").pipe(
  HttpClientRequest.setUrlParam("per_page", "20"),
)

/** The ETag cache over a fake transport answering `replies` in order. */
const cached = (replies: ReadonlyArray<FakeReply>) => {
  const fake = fakeHttpClient(
    () => replies[fake.sent.length - 1] ?? "unreachable",
  )

  return { sent: fake.sent, client: withEtagCache(fake.client) }
}

const bodyOf = (client: ReturnType<typeof cached>["client"], sent = request) =>
  client.execute(sent).pipe(Effect.flatMap(response => response.json))

it.effect("sends If-None-Match and answers a 304 with the cached body", () => {
  const { sent, client } = cached([
    { status: 200, body: { n: 1 }, headers: { etag: 'W/"abc"' } },
    { status: 304 },
  ])

  return Effect.gen(function* () {
    expect(yield* bodyOf(client)).toEqual({ n: 1 })
    const second = yield* client.execute(request)

    expect(second.status).toBe(200)
    expect(yield* second.json).toEqual({ n: 1 })
    expect(sent[0]?.header("if-none-match")).toBeUndefined()
    expect(sent[1]?.header("if-none-match")).toBe('W/"abc"')
  })
})

it.effect("a changed resource replaces the cached body", () => {
  const { sent, client } = cached([
    { status: 200, body: { n: 1 }, headers: { etag: '"1"' } },
    { status: 200, body: { n: 2 }, headers: { etag: '"2"' } },
    { status: 304 },
  ])

  return Effect.gen(function* () {
    yield* bodyOf(client)
    expect(yield* bodyOf(client)).toEqual({ n: 2 })
    expect(yield* bodyOf(client)).toEqual({ n: 2 })
    expect(sent[2]?.header("if-none-match")).toBe('"2"')
  })
})

it.effect("the cache is keyed by URL and query", () => {
  const { sent, client } = cached([
    { status: 200, body: 1, headers: { etag: '"a"' } },
    { status: 200, body: 2 },
  ])

  return Effect.gen(function* () {
    yield* bodyOf(client)
    yield* bodyOf(
      client,
      HttpClientRequest.setUrlParam(request, "per_page", "50"),
    )

    expect(sent[1]?.header("if-none-match")).toBeUndefined()
  })
})

it.effect(
  "responses without an ETag, and errors, pass through untouched",
  () => {
    const { client } = cached([
      { status: 200, body: { n: 1 } },
      { status: 502 },
    ])

    return Effect.gen(function* () {
      expect(yield* bodyOf(client)).toEqual({ n: 1 })
      expect((yield* client.execute(request)).status).toBe(502)
    })
  },
)

it.effect("a POST is never served from the cache, even to the same URL", () => {
  const post = HttpClientRequest.post("https://api.example.com/graphql")

  const { sent, client } = cached([
    { status: 200, body: { query: 1 }, headers: { etag: '"q1"' } },
    { status: 200, body: { query: 2 }, headers: { etag: '"q2"' } },
  ])

  return Effect.gen(function* () {
    yield* client.execute(post)
    expect(yield* (yield* client.execute(post)).json).toEqual({ query: 2 })
    expect(sent[1]?.header("if-none-match")).toBeUndefined()
  })
})
