import {
  Config,
  Effect,
  FileSystem,
  Layer,
  LogLevel,
  Logger,
  Option,
  Path,
  References,
} from "effect"

import { Paths } from "./paths"

const MAX_BYTES = 1024 * 1024

/** Keeps the log small: past 1 MB at startup, the current log becomes `tuiaux.log.1` (replacing the old one). */
const rotate = Effect.fn("Logger.rotate")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem
  const info = yield* fs.stat(file).pipe(Effect.option)

  if (Option.isSome(info) && Number(info.value.size) > MAX_BYTES)
    yield* fs.rename(file, `${file}.1`)
})

/**
 * Sends every log to `~/.local/state/tuiaux/tuiaux.log` (logfmt) and removes the default console logger:
 * nothing may reach stdout/stderr while the TUI runs. If the file can't be opened, logs are dropped
 * rather than printed. Level: `TUIAUX_LOG=Debug|Info|Warn|Error` (default Info).
 */
export const FileLogger: Layer.Layer<
  never,
  never,
  Paths | FileSystem.FileSystem | Path.Path
> = Layer.unwrap(
  Effect.gen(function* () {
    const { logFile } = yield* Paths
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const level = yield* Config.LogLevel("TUIAUX_LOG").pipe(
      Config.withDefault<LogLevel.LogLevel>("Info"),
      Effect.orElseSucceed((): LogLevel.LogLevel => "Info"),
    )

    const ready = yield* fs
      .makeDirectory(path.dirname(logFile), { recursive: true })
      .pipe(
        Effect.andThen(rotate(logFile).pipe(Effect.ignore)),
        Effect.as(true),
        Effect.orElseSucceed(() => false),
      )

    const loggers = ready
      ? Logger.layer(
          [Logger.toFile(Logger.formatLogFmt, logFile, { flag: "a" })],
          {
            mergeWithExisting: false,
          },
        )
      : Logger.layer([], { mergeWithExisting: false })

    return Layer.merge(
      loggers.pipe(
        Layer.catchCause(() => Logger.layer([], { mergeWithExisting: false })),
      ),
      Layer.succeed(References.MinimumLogLevel, level),
    )
  }),
)
