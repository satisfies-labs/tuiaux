import { expect } from "bun:test"
import { Duration, Effect, Fiber, Option, Ref } from "effect"
import { TestClock } from "effect/testing"

import { Network } from "../../src/domain"
import { poll } from "../../src/monitor/poll"
import { it } from "../support/effect"

const network = new Network({
  kind: "github",
  host: "github.com",
  cause: "reset",
})

it.effect(
  "repeats after each delay until a handler stops, counting failures",
  () =>
    Effect.gen(function* () {
      const script: ReadonlyArray<Effect.Effect<number, Network>> = [
        Effect.fail(network),
        Effect.fail(network),
        Effect.succeed(1),
        Effect.fail(network),
      ]

      const calls = yield* Ref.make(0)
      const failures = yield* Ref.make<ReadonlyArray<number>>([])

      const fetch = Ref.getAndUpdate(calls, n => n + 1).pipe(
        Effect.flatMap(n => script[n] ?? Effect.succeed(0)),
      )

      const fiber = yield* poll(fetch, {
        onSuccess: value =>
          Effect.succeed(
            value === 0 ? Option.none() : Option.some(Duration.seconds(1)),
          ),
        onFailure: (_, count) =>
          Ref.update(failures, all => [...all, count]).pipe(
            Effect.as(Option.some(Duration.seconds(1))),
          ),
      }).pipe(Effect.forkChild)

      yield* TestClock.adjust("10 seconds")
      yield* Fiber.join(fiber)

      expect(yield* Ref.get(calls)).toBe(5)
      // Two failures in a row, then a success resets the count.
      expect(yield* Ref.get(failures)).toEqual([1, 2, 1])
    }),
)
