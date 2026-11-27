import { type Duration, Effect, Option } from "effect"

import type { ProviderError } from "../domain"

/** After a fetch: poll again after this delay, or stop. */
export type Next = Option.Option<Duration.Duration>

export interface PollHandlers<A> {
  readonly onSuccess: (value: A) => Effect.Effect<Next>
  /** `failures` counts consecutive failures, from 1, for backoff. */
  readonly onFailure: (
    error: ProviderError,
    failures: number,
  ) => Effect.Effect<Next>
}

/** Fetches, lets the handlers decide what's next, and repeats until one of them says stop. */
export const poll = <A>(
  fetch: Effect.Effect<A, ProviderError>,
  handlers: PollHandlers<A>,
): Effect.Effect<void> => {
  const loop = (failures: number): Effect.Effect<void> =>
    fetch.pipe(
      Effect.matchEffect({
        onSuccess: value =>
          handlers
            .onSuccess(value)
            .pipe(Effect.map(next => [next, 0] as const)),
        onFailure: error =>
          handlers
            .onFailure(error, failures + 1)
            .pipe(Effect.map(next => [next, failures + 1] as const)),
      }),
      Effect.flatMap(([next, count]) =>
        Option.match(next, {
          onNone: () => Effect.void,
          onSome: delay =>
            Effect.sleep(delay).pipe(
              Effect.andThen(Effect.suspend(() => loop(count))),
            ),
        }),
      ),
    )

  return loop(0)
}
