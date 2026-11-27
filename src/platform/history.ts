import {
  Clock,
  Context,
  Effect,
  FileSystem,
  Layer,
  Option,
  Order,
  Path,
  Schema,
  Semaphore,
} from "effect"

import { RepoRef } from "../domain"
import { readFileIfExists, writeFileAtomic } from "./files"
import { Paths } from "./paths"

/** A repo tuiaux has seen with at least one run. */
export class RememberedRepo extends Schema.Class<
  RememberedRepo,
  { readonly brand: unique symbol }
>("RememberedRepo")({
  repo: RepoRef,
  /** Last local checkout it was seen in. */
  localPath: Schema.UndefinedOr(Schema.String),
  lastBranch: Schema.UndefinedOr(Schema.String),
  lastSeenAt: Schema.Date,
}) {}

const HistoryFile = Schema.toCodecJson(
  Schema.Struct({
    version: Schema.Literal(1),
    repos: Schema.Array(RememberedRepo),
  }),
)

export interface Sighting {
  readonly repo: RepoRef
  readonly localPath?: string | undefined
  readonly branch?: string | undefined
}

const byMostRecent = Order.flip(
  Order.mapInput(Order.Number, (r: RememberedRepo) => r.lastSeenAt.getTime()),
)

/**
 * Remembered repos, in `~/.local/state/tuiaux/repos.json`. Never fails: I/O problems are logged and the
 * history behaves as empty. Every change re-reads the file first, so two tuiaux processes don't erase
 * each other's entries, and writes are atomic. A corrupt file is moved aside, never overwritten blindly.
 */
export class RepoHistory extends Context.Service<
  RepoHistory,
  {
    /** Most recently seen first. */
    readonly list: Effect.Effect<ReadonlyArray<RememberedRepo>>
    /** Adds the repo, or refreshes its last-seen time, branch and path. */
    readonly remember: (sighting: Sighting) => Effect.Effect<void>
    readonly forget: (repo: RepoRef) => Effect.Effect<void>
  }
>()("tuiaux/RepoHistory") {
  static readonly layer = Layer.effect(
    RepoHistory,
    Effect.gen(function* () {
      const { historyFile } = yield* Paths
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const lock = yield* Semaphore.make(1)

      const provide = <A, E>(
        self: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
      ) =>
        self.pipe(
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(Path.Path, path),
        )

      const read = Effect.gen(function* () {
        const content = yield* readFileIfExists(historyFile)

        if (Option.isNone(content)) return []

        const decoded = yield* Schema.decodeEffect(
          Schema.fromJsonString(HistoryFile),
        )(content.value).pipe(Effect.option)

        if (Option.isSome(decoded)) return decoded.value.repos
        const aside = `${historyFile}.corrupt-${Date.now()}`
        yield* Effect.logWarning("history: unreadable file moved aside", aside)
        yield* fs.rename(historyFile, aside)

        return []
      })

      const write = (repos: ReadonlyArray<RememberedRepo>) =>
        Schema.encodeEffect(HistoryFile)({ version: 1, repos }).pipe(
          Effect.flatMap(json =>
            writeFileAtomic(historyFile, `${JSON.stringify(json, null, 2)}\n`),
          ),
        )

      const modify = (
        name: string,
        f: (
          repos: ReadonlyArray<RememberedRepo>,
        ) => ReadonlyArray<RememberedRepo>,
      ) =>
        lock
          .withPermit(read.pipe(Effect.flatMap(repos => write(f(repos)))))
          .pipe(
            provide,
            Effect.catchCause(cause =>
              Effect.logWarning(`history: ${name} failed`, cause),
            ),
          )

      return {
        list: lock.withPermit(read).pipe(
          provide,
          Effect.map(repos => repos.toSorted(byMostRecent)),
          Effect.catchCause(cause =>
            Effect.logWarning("history: read failed", cause).pipe(
              Effect.as([]),
            ),
          ),
        ),

        remember: sighting =>
          Effect.flatMap(Clock.currentTimeMillis, now =>
            modify("remember", repos => {
              const previous = repos.find(r => r.repo.key === sighting.repo.key)

              const entry = new RememberedRepo({
                repo: sighting.repo,
                localPath: sighting.localPath ?? previous?.localPath,
                lastBranch: sighting.branch ?? previous?.lastBranch,
                lastSeenAt: new Date(now),
              })

              return [
                entry,
                ...repos.filter(r => r.repo.key !== sighting.repo.key),
              ]
            }),
          ),

        forget: repo =>
          modify("forget", repos => repos.filter(r => r.repo.key !== repo.key)),
      }
    }),
  )
}
