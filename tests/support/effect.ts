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
import { test } from "bun:test";
import { Cause, Effect, Exit, Layer, type Scope } from "effect";
import { TestClock, TestConsole } from "effect/testing";

/** Services every `it.effect` test gets for free. */
export type TestServices = TestClock.TestClock | TestConsole.TestConsole;

const TestEnv: Layer.Layer<TestServices> = Layer.mergeAll(TestConsole.layer, TestClock.layer());

type Body<R> = () => Effect.Effect<unknown, unknown, R>;
type Timeout = number | undefined;

export interface Tester<R> {
  (name: string, body: Body<R>, timeout?: Timeout): void;
  only: (name: string, body: Body<R>, timeout?: Timeout) => void;
  skip: (name: string, body: Body<R>, timeout?: Timeout) => void;
  todo: (name: string) => void;
}

export interface Methods<R> {
  /** Runs with TestClock and TestConsole: time only moves with `TestClock.adjust`. */
  readonly effect: Tester<R | TestServices | Scope.Scope>;
  /** Runs with the real clock and console. */
  readonly live: Tester<R | Scope.Scope>;
}

/**
 * Runs an Effect as a test body. Resolves on success. On failure, rejects with:
 * - the original Error for a plain defect (failed `expect`, bug), so bun shows the frame where it was thrown;
 * - `Cause.pretty` otherwise (typed failures, interruptions, several errors).
 */
export const run = async (effect: Effect.Effect<unknown, unknown>): Promise<void> => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) {
    const squashed = Cause.squash(exit.cause);
    if (!Cause.hasFails(exit.cause) && squashed instanceof Error) throw squashed;
    const error = new Error(Cause.pretty(exit.cause));
    error.name = "EffectTestFailure";
    throw error;
  }
};

const makeTester = <R>(
  provide: (self: Effect.Effect<unknown, unknown, R>) => Effect.Effect<unknown, unknown>,
) => {
  const toFn = (body: Body<R>) => () => run(provide(Effect.suspend(body)));
  const tester = ((name, body, timeout) => test(name, toFn(body), timeout)) as Tester<R>;
  tester.only = (name, body, timeout) => test.only(name, toFn(body), timeout);
  tester.skip = (name, body, timeout) => test.skip(name, toFn(body), timeout);
  tester.todo = (name) => test.todo(name);
  return tester;
};

const makeMethods = <R, E>(services: Layer.Layer<R, E>): Methods<R> => ({
  effect: makeTester((self) =>
    Effect.scoped(self).pipe(Effect.provide(Layer.provideMerge(services, TestEnv), { local: true })),
  ),
  live: makeTester((self) => Effect.scoped(self).pipe(Effect.provide(services, { local: true }))),
});

/** Tests with no extra services. */
export const it: Methods<never> = makeMethods(Layer.empty);

/**
 * Tests that need services. The layer is built for each test (and torn down after it), so tests never
 * share state. Inside `it.effect`, the layer itself sees TestClock and TestConsole.
 */
export const layer =
  <R, E>(services: Layer.Layer<R, E>) =>
  (define: (it: Methods<R>) => void): void =>
    define(makeMethods(services));
