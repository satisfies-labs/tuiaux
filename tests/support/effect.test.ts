import { describe, expect, test } from "bun:test";
import { Context, Data, Effect, Fiber, Layer, Ref } from "effect";
import { TestClock } from "effect/testing";
import { it, layer, run } from "./effect";

class Boom extends Data.TaggedError("Boom")<{ readonly reason: string }> {}

class Counter extends Context.Service<Counter, { readonly ref: Ref.Ref<number> }>()("test/Counter") {}
const CounterLive = Layer.effect(
  Counter,
  Effect.map(Ref.make(0), (ref) => ({ ref })),
);

describe("it.effect", () => {
  it.effect("time only moves with TestClock.adjust", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(Effect.sleep("1 hour"));
      yield* TestClock.adjust("59 minutes");
      expect(fiber.pollUnsafe()).toBeUndefined();
      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(fiber);
    }),
  );

  // bun runs the tests of a file in order: the second one sees what the first one's finalizer did.
  let finalized = false;
  it.effect("provides a Scope …", () => Effect.addFinalizer(() => Effect.sync(() => (finalized = true))));
  it.effect("… that is closed when the test ends", () => Effect.sync(() => expect(finalized).toBe(true)));
});

describe("run", () => {
  test("rejects with the pretty cause of a typed failure", async () => {
    await expect(run(Effect.fail(new Boom({ reason: "kaput" })))).rejects.toThrow(/Boom/);
  });

  test("rejects on defects", async () => {
    await expect(run(Effect.die(new Error("bug")))).rejects.toThrow(/bug/);
  });
});

describe("it.live", () => {
  it.live("uses the real clock", () =>
    Effect.gen(function* () {
      const start = Date.now();
      yield* Effect.sleep("5 millis");
      expect(Date.now() - start).toBeGreaterThanOrEqual(4);
    }),
  );
});

layer(CounterLive)((withCounter) => {
  withCounter.effect("provides the layer's services", () =>
    Effect.gen(function* () {
      const { ref } = yield* Counter;
      yield* Ref.update(ref, (n) => n + 1);
      expect(yield* Ref.get(ref)).toBe(1);
    }),
  );

  withCounter.effect("builds the layer fresh for every test", () =>
    Effect.gen(function* () {
      const { ref } = yield* Counter;
      expect(yield* Ref.get(ref)).toBe(0);
    }),
  );
});
