import { Clock, Effect, Layer, Option } from "effect"

import type { RepoKey } from "../../src/domain"
import {
  type CachedRuns,
  RememberedRepo,
  RepoHistory,
  RunCache,
} from "../../src/platform"

/**
 * In-memory `RepoHistory` and `RunCache`. The real ones do file I/O, which takes real time and would
 * race with `TestClock`; these are synchronous, so Monitor tests are deterministic.
 */
export const memoryStorage: Layer.Layer<RepoHistory | RunCache> =
  Layer.mergeAll(
    Layer.sync(RepoHistory, () => {
      const repos = new Map<RepoKey, RememberedRepo>()

      return {
        list: Effect.sync(() =>
          [...repos.values()].toSorted(
            (a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime(),
          ),
        ),
        remember: sighting =>
          Clock.currentTimeMillis.pipe(
            Effect.map(millis => {
              repos.set(
                sighting.repo.key,
                new RememberedRepo({
                  repo: sighting.repo,
                  localPath: sighting.localPath,
                  lastBranch: sighting.branch,
                  lastSeenAt: new Date(millis),
                }),
              )
            }),
          ),
        forget: repo => Effect.sync(() => void repos.delete(repo.key)),
      }
    }),
    Layer.sync(RunCache, () => {
      const entries = new Map<RepoKey, CachedRuns>()

      return {
        read: repo =>
          Effect.sync(() => Option.fromNullishOr(entries.get(repo.key))),
        write: entry =>
          Effect.sync(() => void entries.set(entry.repo.key, entry)),
        remove: repo => Effect.sync(() => void entries.delete(repo.key)),
      }
    }),
  )
