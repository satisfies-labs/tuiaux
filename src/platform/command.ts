import { Duration, Effect, Stream } from "effect"
import type { PlatformError } from "effect/PlatformError"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface CommandOptions {
  readonly cwd?: string
  readonly env?: Record<string, string>
  /** Kill the process after this long. Default 10 s. */
  readonly timeout?: Duration.Input
}

const text = (stream: Stream.Stream<Uint8Array, PlatformError>) =>
  Stream.mkString(Stream.decodeText(stream))

/**
 * Runs a command to completion and returns its exit code and output.
 * Unlike `ChildProcessSpawner.string`, a non-zero exit code is a result, not something silently dropped.
 * Fails with a `PlatformError` when the binary can't be spawned (`reason._tag === "NotFound"` if missing),
 * and with `TimeoutError` after `timeout`.
 */
export const runCommand = Effect.fn("Command.run")(function* (
  command: string,
  args: ReadonlyArray<string>,
  options: CommandOptions = {},
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(
        // `env` adds to the inherited environment instead of replacing it.
        ChildProcess.make(command, args, {
          cwd: options.cwd,
          env: options.env,
          extendEnv: true,
        }),
      )

      const [stdout, stderr, exitCode] = yield* Effect.all(
        [text(handle.stdout), text(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" },
      )

      return {
        exitCode: Number(exitCode),
        stdout,
        stderr,
      } satisfies CommandResult
    }),
  ).pipe(Effect.timeout(options.timeout ?? Duration.seconds(10)))
})
