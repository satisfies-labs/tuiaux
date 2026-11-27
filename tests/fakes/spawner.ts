import { Effect, Layer, Sink, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { BunServices } from "@effect/platform-bun"

/** What a fake binary does: print and exit, or not exist at all. */
export type FakeBinary =
  | { readonly exitCode: number; readonly stdout: string }
  | "missing"

/** Spawned for real when a fake binary is missing, so the error is the genuine "not found" one. */
const NONEXISTENT = "tuiaux-test-binary-that-does-not-exist"

const output = (text: string) => Stream.make(new TextEncoder().encode(text))

/**
 * A ChildProcessSpawner that never starts the real tools: each command name maps to a canned result.
 * Unknown commands behave as missing binaries. `calls` records every command line, to assert caching.
 */
export const fakeSpawner = (binaries: Readonly<Record<string, FakeBinary>>) => {
  const calls: Array<string> = []

  const layer = Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const real = yield* ChildProcessSpawner.ChildProcessSpawner

      return ChildProcessSpawner.make(command => {
        const [name, args] = ChildProcess.isStandardCommand(command)
          ? [command.command, command.args.map(String)]
          : ["piped", []]

        calls.push([name, ...args].join(" "))
        const binary = binaries[name] ?? "missing"

        if (binary === "missing")
          return real.spawn(ChildProcess.make(NONEXISTENT, []))

        return Effect.succeed(
          ChildProcessSpawner.makeHandle({
            pid: ChildProcessSpawner.ProcessId(1),
            // A real process takes time: let other fibers run before it exits.
            exitCode: Effect.yieldNow.pipe(
              Effect.as(ChildProcessSpawner.ExitCode(binary.exitCode)),
            ),
            isRunning: Effect.succeed(false),
            kill: () => Effect.void,
            stdin: Sink.drain,
            stdout: output(binary.stdout),
            stderr: Stream.empty,
            all: output(binary.stdout),
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
            unref: Effect.succeed(Effect.void),
          }),
        )
      })
    }),
  ).pipe(Layer.provide(BunServices.layer))

  return { calls, layer }
}
