import {
  Context,
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
  Schema,
} from "effect"

import { RepoRef, Run } from "../domain"
import { readFileIfExists, writeFileAtomic } from "./files"
import { Paths } from "./paths"

/** The last runs fetched for a repo, used to draw it instantly (marked stale) before or without polling. */
export class CachedRuns extends Schema.Class<
  CachedRuns,
  { readonly brand: unique symbol }
>("CachedRuns")({
  repo: RepoRef,
  runs: Schema.Array(Run),
  fetchedAt: Schema.Date,
}) {}

/** Bump when cached runs can't be trusted anymore (shape or meaning): old files are ignored and replaced. */
// 2: run durations no longer come from `updated_at`.
const VERSION = 2

const CacheFile = Schema.toCodecJson(
  Schema.Struct({ version: Schema.Literal(VERSION), entry: CachedRuns }),
)

/**
 * Last known runs per repo, one file each in `~/.cache/tuiaux/runs/`. Disposable: never fails, a missing,
 * outdated or corrupt file reads as None.
 */
export class RunCache extends Context.Service<
  RunCache,
  {
    readonly read: (repo: RepoRef) => Effect.Effect<Option.Option<CachedRuns>>
    readonly write: (entry: CachedRuns) => Effect.Effect<void>
    readonly remove: (repo: RepoRef) => Effect.Effect<void>
  }
>()("tuiaux/RunCache") {
  static readonly layer = Layer.effect(
    RunCache,
    Effect.gen(function* () {
      const { runCacheDir } = yield* Paths
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const fileOf = (repo: RepoRef) =>
        path.join(runCacheDir, `${encodeURIComponent(repo.key)}.json`)

      const provide = <A, E>(
        self: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
      ) =>
        self.pipe(
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(Path.Path, path),
        )

      return {
        read: repo =>
          readFileIfExists(fileOf(repo)).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.succeedNone,
                onSome: content =>
                  Schema.decodeEffect(Schema.fromJsonString(CacheFile))(
                    content,
                  ).pipe(
                    Effect.map(file => Option.some(file.entry)),
                    Effect.catch(() =>
                      Effect.logDebug(
                        "run cache: dropping unreadable entry",
                        repo.key,
                      ).pipe(
                        Effect.andThen(
                          fs.remove(fileOf(repo)).pipe(Effect.ignore),
                        ),
                        Effect.as(Option.none<CachedRuns>()),
                      ),
                    ),
                  ),
              }),
            ),
            provide,
            Effect.catchCause(cause =>
              Effect.logWarning("run cache: read failed", cause).pipe(
                Effect.as(Option.none<CachedRuns>()),
              ),
            ),
          ),

        write: entry =>
          Schema.encodeEffect(CacheFile)({ version: VERSION, entry }).pipe(
            Effect.flatMap(json =>
              writeFileAtomic(fileOf(entry.repo), JSON.stringify(json)),
            ),
            provide,
            Effect.catchCause(cause =>
              Effect.logWarning("run cache: write failed", cause),
            ),
          ),

        remove: repo =>
          fs
            .remove(fileOf(repo), { force: true })
            .pipe(
              Effect.catchCause(cause =>
                Effect.logWarning("run cache: remove failed", cause),
              ),
            ),
      }
    }),
  )
}
