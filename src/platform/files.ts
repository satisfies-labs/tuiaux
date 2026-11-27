import { Effect, FileSystem, Option, Path, Predicate } from "effect"
import type { PlatformError } from "effect/PlatformError"

export const isNotFound = (error: PlatformError): boolean =>
  Predicate.isTagged(error.reason, "NotFound")

/** Reads a text file; None when it doesn't exist. Other errors (permissions, …) still fail. */
export const readFileIfExists = Effect.fn("Files.readIfExists")(function* (
  file: string,
) {
  const fs = yield* FileSystem.FileSystem

  return yield* fs.readFileString(file).pipe(
    Effect.map(Option.some),
    Effect.catchIf(isNotFound, () => Effect.succeed(Option.none<string>())),
  )
})

/**
 * Writes a text file atomically: the content goes to a temp file in the same directory, then is renamed
 * over the target. Readers (including another tuiaux process) see the old file or the new one, never half.
 * Creates missing parent directories.
 */
export const writeFileAtomic = Effect.fn("Files.writeAtomic")(function* (
  file: string,
  content: string,
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs.makeDirectory(path.dirname(file), { recursive: true })
  const tmp = `${file}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`
  yield* fs.writeFileString(tmp, content).pipe(
    Effect.andThen(fs.rename(tmp, file)),
    Effect.onError(() => fs.remove(tmp).pipe(Effect.ignore)),
  )
})
