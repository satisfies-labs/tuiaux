import { expect } from "bun:test"
import { Effect, FileSystem, Layer, Path } from "effect"
import { TestConsole } from "effect/testing"

import { FileLogger, Paths } from "../../src/platform"
import { layer } from "../support/effect"
import { TestPlatform, testPlatform } from "../support/platform"

/** Runs `body` with the file logger, closes it (flushing), returns the log file content. */
const logged = (body: Effect.Effect<void>) =>
  Effect.gen(function* () {
    const { logFile } = yield* Paths
    const fs = yield* FileSystem.FileSystem
    yield* Effect.scoped(
      Layer.build(FileLogger).pipe(
        Effect.flatMap(ctx => Effect.provideContext(body, ctx)),
      ),
    )

    return yield* fs.readFileString(logFile)
  })

layer(TestPlatform)(it => {
  it.effect("writes logs to the log file, never to the console", () =>
    Effect.gen(function* () {
      const content = yield* logged(Effect.logInfo("hello from the TUI"))
      expect(content).toContain('message="hello from the TUI"')
      expect(content).toContain("level=INFO")
      expect(yield* TestConsole.logLines).toEqual([])
      expect(yield* TestConsole.errorLines).toEqual([])
    }),
  )

  it.effect("drops debug logs by default", () =>
    Effect.gen(function* () {
      const content = yield* logged(
        Effect.logDebug("noise").pipe(Effect.andThen(Effect.logInfo("signal"))),
      )

      expect(content).not.toContain("noise")
      expect(content).toContain("signal")
    }),
  )

  it.effect("appends across runs, and rotates past 1 MB at startup", () =>
    Effect.gen(function* () {
      const { logFile } = yield* Paths
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      yield* logged(Effect.logInfo("first"))
      expect(yield* logged(Effect.logInfo("second"))).toContain("first")
      yield* fs.writeFileString(logFile, "x".repeat(1024 * 1024 + 1))
      const content = yield* logged(Effect.logInfo("after rotation"))
      expect(content).not.toContain("xxx")
      expect(content).toContain("after rotation")
      expect(
        yield* fs.exists(path.join(path.dirname(logFile), "tuiaux.log.1")),
      ).toBe(true)
    }),
  )
})

layer(testPlatform(home => ({ HOME: home, TUIAUX_LOG: "Debug" })))(it => {
  it.effect("TUIAUX_LOG=Debug keeps debug logs", () =>
    Effect.map(logged(Effect.logDebug("details")), content =>
      expect(content).toContain("details"),
    ),
  )
})
