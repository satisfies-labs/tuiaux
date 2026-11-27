import { Context, Effect, Layer } from "effect"
import { ChildProcessSpawner } from "effect/process"

import { runCommand } from "./command"

/** Opens web pages in the user's browser. Never fails: a problem is logged, the TUI goes on. */
export class Opener extends Context.Service<
  Opener,
  { readonly open: (url: string) => Effect.Effect<void> }
>()("tuiaux/Opener") {
  static readonly layer = Layer.effect(
    Opener,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const command = process.platform === "darwin" ? "open" : "xdg-open"

      return {
        open: Effect.fn("Opener.open")(function* (url: string) {
          // URLs come from CI APIs: only ever hand web pages to the system opener.
          if (!url.startsWith("https://"))
            return yield* Effect.logWarning(
              "opener: refused non-https URL",
              url,
            )

          const result = yield* runCommand(command, [url]).pipe(
            Effect.provideService(
              ChildProcessSpawner.ChildProcessSpawner,
              spawner,
            ),
            Effect.catchCause(cause =>
              Effect.logWarning(`opener: ${command} failed`, cause).pipe(
                Effect.as(undefined),
              ),
            ),
          )

          if (result !== undefined && result.exitCode !== 0)
            yield* Effect.logWarning(
              `opener: ${command} exited with ${result.exitCode}`,
              result.stderr,
            )
        }),
      }
    }),
  )
}
