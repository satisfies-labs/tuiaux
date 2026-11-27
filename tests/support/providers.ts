/** Helpers for provider tests: build a provider over a fake API and a fake CLI, assert its errors. */
import { expect } from "bun:test"
import { Effect, Layer } from "effect"

import type { ProviderError } from "../../src/domain"
import type { Provider, ProviderModule } from "../../src/providers/provider"
import {
  type FakeReply,
  type SentRequest,
  fakeHttpClient,
} from "../fakes/http-client"
import { type FakeBinary, fakeSpawner } from "../fakes/spawner"

/**
 * Builds `module` with `cli` answering for its binary and `route` answering its API, then runs `use`.
 * Returns the effect plus the recorded requests and CLI calls.
 */
export const withProvider = <A, E>(
  module: ProviderModule,
  binary: string,
  route: (request: SentRequest) => FakeReply,
  use: (provider: Provider) => Effect.Effect<A, E>,
  cli: FakeBinary,
) => {
  const http = fakeHttpClient(route)
  const spawner = fakeSpawner({ [binary]: cli })

  return {
    http,
    spawner,
    effect: module.make.pipe(
      Effect.flatMap(use),
      Effect.provide(Layer.merge(http.layer, spawner.layer)),
    ),
  }
}

/** A route that always gives the same reply. */
export const always = (reply: FakeReply) => (): FakeReply => reply

/** Asserts the error's class, then the fields the test is about. */
export const failsWith =
  <E extends ProviderError>(
    type: abstract new (...args: never) => E,
    fields: Partial<E>,
  ) =>
  (error: ProviderError) => {
    expect(error).toBeInstanceOf(type)
    expect(error).toMatchObject(fields)
  }
