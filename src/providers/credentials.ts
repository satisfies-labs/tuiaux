import { Cache, Duration, Effect, Exit, Redacted } from "effect"
import { isPlatformError } from "effect/PlatformError"
import { ChildProcessSpawner } from "effect/process"

import { AuthMissing, type ProviderKind } from "../domain"
import { isNotFound, runCommand } from "../platform"

/** How to get a token from a provider's own CLI. */
export interface CliToken {
  readonly kind: ProviderKind
  readonly host: string
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** Shown when the CLI is logged out: "Run `gh auth login`". */
  readonly loginHint: string
  /** Shown when the CLI isn't installed. */
  readonly installHint: string
}

export interface Credentials {
  /** The token, read from the CLI once and shared by concurrent callers. Failures aren't kept. */
  readonly token: Effect.Effect<Redacted.Redacted, AuthMissing>
  /** Forget the token (it was rejected), so the next call asks the CLI again. */
  readonly invalidate: Effect.Effect<void>
}

/** Credentials read from a CLI, kept only in memory and never logged. */
export const cliCredentials = Effect.fn("Credentials.make")(function* (
  spec: CliToken,
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

  const missing = (reason: AuthMissing["reason"]) =>
    new AuthMissing({
      kind: spec.kind,
      host: spec.host,
      reason,
      hint: reason === "cli-not-installed" ? spec.installHint : spec.loginHint,
    })

  const read = runCommand(spec.command, spec.args).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    Effect.mapError(error =>
      missing(
        isPlatformError(error) && isNotFound(error)
          ? "cli-not-installed"
          : "not-logged-in",
      ),
    ),
    Effect.flatMap(({ exitCode, stdout }) =>
      exitCode === 0 && stdout.trim() !== ""
        ? Effect.succeed(Redacted.make(stdout.trim()))
        : Effect.fail(missing("not-logged-in")),
    ),
  )

  // One entry: the token. Kept until invalidated; a failure expires at once so logging in then
  // refreshing works.
  const cache = yield* Cache.makeWith(() => read, {
    capacity: 1,
    timeToLive: Exit.match({
      onFailure: () => Duration.zero,
      onSuccess: () => Duration.infinity,
    }),
  })

  return {
    token: Cache.get(cache, spec.command),
    invalidate: Cache.invalidate(cache, spec.command),
  } satisfies Credentials
})
