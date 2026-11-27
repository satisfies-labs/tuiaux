import { Context, Effect, Layer, Option } from "effect"

import type { Job, ProviderError, RepoRef, Run, RunRef } from "../../src/domain"
import { Git, type LocalRepo } from "../../src/platform"
import { Providers, providers } from "../../src/providers"

type Answer<A> = Effect.Effect<ReadonlyArray<A>, ProviderError>

/**
 * Scripted CI behind the real `Providers` contract: each test says what a repo's runs (or a run's
 * jobs) are, changes it over time, and reads which calls were made.
 */
export class FakeCi extends Context.Service<
  FakeCi,
  {
    readonly runs: (repo: RepoRef, answer: Answer<Run>) => Effect.Effect<void>
    readonly jobs: (run: RunRef, answer: Answer<Job>) => Effect.Effect<void>
    /** Repo keys passed to `listRuns`, in call order. */
    readonly polled: Effect.Effect<ReadonlyArray<string>>
    /** Run ids passed to `listJobs`, in call order. */
    readonly polledJobs: Effect.Effect<ReadonlyArray<string>>
  }
>()("test/FakeCi") {
  static readonly layer: Layer.Layer<FakeCi | Providers> = Layer.effectContext(
    Effect.sync(() => {
      const runs = new Map<string, Answer<Run>>()
      const jobs = new Map<string, Answer<Job>>()
      const polled: Array<string> = []
      const polledJobs: Array<string> = []

      const fake: FakeCi["Service"] = {
        runs: (repo, answer) =>
          Effect.sync(() => void runs.set(repo.key, answer)),
        jobs: (run, answer) => Effect.sync(() => void jobs.set(run.id, answer)),
        polled: Effect.sync(() => [...polled]),
        polledJobs: Effect.sync(() => [...polledJobs]),
      }

      const ci: Providers["Service"] = {
        get: kind => ({
          kind,
          capabilities: { rerun: false, cancel: false, logs: "none" },
          listRuns: repo =>
            Effect.suspend(() => {
              polled.push(repo.key)

              return runs.get(repo.key) ?? Effect.succeed([])
            }),
          listJobs: run =>
            Effect.suspend(() => {
              polledJobs.push(run.id)

              return jobs.get(run.id) ?? Effect.succeed([])
            }),
        }),
        matchRemote: url =>
          Option.firstSomeOf(
            Object.values(providers).map(module => module.matchRemote(url)),
          ),
      }

      return Context.make(FakeCi, fake).pipe(Context.add(Providers, ci))
    }),
  )
}

/** A `Git` that sees `local` (None: not in a git checkout). */
export const fakeGit = (local: Option.Option<LocalRepo>) =>
  Layer.succeed(Git, { detect: () => Effect.succeed(local) })

/** A checkout of `remote` on `branch`. */
export const checkout = (remote: string, branch = "main") =>
  Option.some<LocalRepo>({
    root: "/work/repo",
    branch: Option.some(branch),
    remotes: [{ name: "origin", url: remote }],
  })
