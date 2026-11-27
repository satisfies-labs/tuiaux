import { Array as Arr, Effect, Option } from "effect"

import { Git, RepoHistory, RunCache } from "../platform"
import { Providers } from "../providers"
import { MonitorState, RepoEntry, RepoHealth } from "./state"

/**
 * The repos to list at startup: the repo of `cwd` first (when a provider hosts its remote), then
 * remembered repos, each drawn from its cached runs.
 */
export const loadRepos = Effect.fn("Monitor.loadRepos")(function* (
  cwd: string,
) {
  const providers = yield* Providers
  const cache = yield* RunCache
  const local = yield* (yield* Git).detect(cwd)

  const current = local.pipe(
    Option.flatMap(checkout =>
      Option.firstSomeOf(
        checkout.remotes.map(remote => providers.matchRemote(remote.url)),
      ),
    ),
  )

  const remembered = (yield* (yield* RepoHistory).list).map(entry => entry.repo)

  const refs = Arr.dedupeWith(
    [...Option.toArray(current), ...remembered],
    (a, b) => a.key === b.key,
  )

  const repos = yield* Effect.forEach(refs, repo =>
    cache.read(repo).pipe(
      Effect.map(
        cached =>
          new RepoEntry({
            repo,
            current: Option.exists(current, c => c.key === repo.key),
            runs: Option.match(cached, {
              onNone: () => [],
              onSome: entry => entry.runs,
            }),
            fetchedAt: Option.getOrUndefined(cached)?.fetchedAt,
            stale: true,
            health: RepoHealth.Ok(),
          }),
      ),
    ),
  )

  return {
    local,
    current,
    state: new MonitorState({
      inGitRepo: Option.isSome(local),
      repos,
      hostIssues: [],
      focusedRepo: undefined,
      focusedRun: undefined,
    }),
  }
})
