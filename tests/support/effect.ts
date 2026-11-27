/**
 * Effect bindings for `bun:test`, modelled on `@effect/vitest`.
 *
 *   it.effect("name", () => Effect.gen(function* () { … }))   // TestClock + TestConsole, scoped
 *   it.live("name", () => …)                                   // real clock, scoped
 *   layer(MyLayer)((it) => { it.effect(…) })                   // services built fresh per test
 *
 * Every test runs in its own Scope, closed when the test ends (finalizers run, fibers are interrupted).
 * A failure or defect fails the test with `Cause.pretty`, so typed errors show their tag and fields.
 */
import { test } from "bun:test"
import { Cause, Effect, Exit, Layer, type Scope } from "effect"
import { TestClock, TestConsole } from "effect/testing"

/** Services every `it.effect` test gets for free. */
export type TestServices = TestClock.TestClock | TestConsole.TestConsole

const TestEnv: Layer.Layer<TestServices> = Layer.mergeAll(
  TestConsole.layer,
  TestClock.layer(),
)

type Timeout = number | undefined

/** Registers one test. Generic per call: each test keeps its own success and error types. */
type Register<R> = <A, E>(
  name: string,
  body: () => Effect.Effect<A, E, R>,
  timeout?: Timeout,
) => void

export interface Tester<R> extends Register<R> {
  readonly only: Register<R>
  readonly skip: Register<R>
  readonly todo: (name: string) => void
}

export interface Methods<R> {
  /** Runs with TestClock and TestConsole: time only moves with `TestClock.adjust`. */
  readonly effect: Tester<R | TestServices | Scope.Scope>
  /** Runs with the real clock and console. */
  readonly live: Tester<R | Scope.Scope>
}

/**
 * Runs an Effect as a test body. Resolves on success. On failure, rejects with:
 * - the original Error for a plain defect (failed `expect`, bug), so bun shows the frame where it was thrown;
 * - `Cause.pretty` otherwise (typed failures, interruptions, several errors).
 */
export const run = async <A, E>(effect: Effect.Effect<A, E>): Promise<void> => {
  const exit = await Effect.runPromiseExit(effect)

  if (Exit.isFailure(exit)) {
    const squashed = Cause.squash(exit.cause)

    if (!Cause.hasFails(exit.cause) && squashed instanceof Error) throw squashed
    const error = new Error(Cause.pretty(exit.cause))
    error.name = "EffectTestFailure"
    throw error
  }
}

/** Provides what a test needs: from an effect needing `R` to one needing nothing (it may add errors). */
type Provide<R, EL> = <A, E>(
  self: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E | EL>

const makeTester = <R, EL>(provide: Provide<R, EL>): Tester<R> => {
  type Kind = typeof test | typeof test.only | typeof test.skip

  const register =
    (kind: Kind): Register<R> =>
    (name, body, timeout) =>
      kind(name, () => run(provide(Effect.suspend(body))), timeout)

  // `test.only` throws as soon as it's read when CI is set: read it only when a test asks for it.
  return Object.assign(register(test), {
    only: ((name, body, timeout) =>
      register(test.only)(name, body, timeout)) satisfies Register<R>,
    skip: register(test.skip),
    todo: (name: string) => test.todo(name),
  })
}

const makeMethods = <R, EL>(services: Layer.Layer<R, EL>): Methods<R> => ({
  effect: makeTester(self =>
    Effect.scoped(self).pipe(
      Effect.provide(Layer.provideMerge(services, TestEnv), { local: true }),
    ),
  ),
  live: makeTester(self =>
    Effect.scoped(self).pipe(Effect.provide(services, { local: true })),
  ),
})

/** Tests with no extra services. */
export const it: Methods<never> = makeMethods(Layer.empty)

/**
 * Tests that need services. The layer is built for each test (and torn down after it), so tests never
 * share state. Inside `it.effect`, the layer itself sees TestClock and TestConsole.
 */
export const layer =
  <R, EL>(services: Layer.Layer<R, EL>) =>
  (define: (it: Methods<R>) => void): void =>
    define(makeMethods(services))
