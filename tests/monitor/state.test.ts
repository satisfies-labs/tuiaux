import { describe, expect } from "bun:test"
import { Duration, Effect } from "effect"

import { NotFound, RateLimited, RunId } from "../../src/domain"
import {
  MonitorState,
  RepoEntry,
  RepoHealth,
  backoff,
  settledRuns,
} from "../../src/monitor"
import { T0, job, repo, run, runRef } from "../support/domain"
import { it } from "../support/effect"

const entry = (
  overrides: Partial<ConstructorParameters<typeof RepoEntry>[0]> = {},
) =>
  new RepoEntry({
    repo: repo(),
    current: false,
    runs: [],
    fetchedAt: undefined,
    stale: true,
    health: RepoHealth.Ok(),
    ...overrides,
  })

const stateOf = (
  overrides: Partial<ConstructorParameters<typeof MonitorState>[0]> = {},
) =>
  new MonitorState({
    inGitRepo: true,
    repos: [],
    hostIssues: [],
    focusedRepo: undefined,
    focusedRun: undefined,
    ...overrides,
  })

const paths = (state: MonitorState) => state.hotRepos.map(r => r.path)

describe("hotRepos", () => {
  it.effect(
    "the current repo, the focused one and those with an active run",
    () =>
      Effect.sync(() => {
        const state = stateOf({
          repos: [
            entry({ repo: repo("a/current"), current: true }),
            entry({ repo: repo("a/focused") }),
            entry({
              repo: repo("a/running"),
              runs: [run({ status: "running" })],
            }),
            entry({ repo: repo("a/cold"), runs: [run({ status: "success" })] }),
          ],
          focusedRepo: repo("a/focused").key,
        })

        expect(paths(state)).toEqual(["a/current", "a/focused", "a/running"])
      }),
  )

  it.effect("never a repo whose host has an issue", () =>
    Effect.sync(() => {
      const state = stateOf({
        repos: [
          entry({ repo: repo("a/gh"), current: true }),
          entry({
            repo: repo("a/gl", "gitlab"),
            runs: [run({ status: "queued" })],
          }),
        ],
        hostIssues: [
          new RateLimited({ kind: "github", host: "github.com", resetAt: T0 }),
        ],
      })

      expect(paths(state)).toEqual(["a/gl"])
    }),
  )

  it.effect(
    "never a repo that wasn't found, but a missing run doesn't stop it",
    () =>
      Effect.sync(() => {
        const failing = (resource: "repo" | "run") =>
          RepoHealth.Failing({
            error: new NotFound({ repo: repo(), resource }),
            since: T0,
            nextRetryAt: undefined,
          })

        const state = stateOf({
          repos: [
            entry({
              repo: repo("a/gone"),
              current: true,
              health: failing("repo"),
            }),
            entry({
              repo: repo("a/ok"),
              current: true,
              health: failing("run"),
            }),
          ],
        })

        expect(paths(state)).toEqual(["a/ok"])
      }),
  )
})

describe("MonitorState transitions", () => {
  const limited = new RateLimited({
    kind: "github",
    host: "github.com",
    resetAt: T0,
  })

  it.effect("failing keeps when it started failing", () =>
    Effect.sync(() => {
      const later = new Date(T0.getTime() + 60_000)
      const error = new NotFound({ repo: repo(), resource: "run" })

      const state = stateOf({ repos: [entry()] })
        .failing(repo(), error, T0, undefined)
        .failing(repo(), error, later, undefined)

      expect(state.entry(repo())?.health).toMatchObject({ since: T0 })
    }),
  )

  it.effect("block replaces the issue of a host; fetched clears it", () =>
    Effect.sync(() => {
      const blocked = stateOf({ repos: [entry()] })
        .block(limited)
        .block(limited)

      expect(blocked.hostIssues).toHaveLength(1)
      expect(blocked.fetched(repo(), [run()], T0).hostIssues).toEqual([])
    }),
  )

  it.effect("refreshed clears host issues and failing repos", () =>
    Effect.sync(() => {
      const state = stateOf({ repos: [entry()] })
        .failing(repo(), limited, T0, undefined)
        .block(limited)
        .refreshed()

      expect(state.hostIssues).toEqual([])
      expect(state.entry(repo())?.health).toEqual(RepoHealth.Ok())
    }),
  )

  it.effect("jobs only land on the run that is still focused", () =>
    Effect.sync(() => {
      const focused = stateOf().focusRun(runRef("1"))

      expect(focused.withJobs(runRef("2"), [job()]).focusedRun?.jobs).toEqual(
        [],
      )
      expect(
        focused.withJobs(runRef("1"), [job()]).focusedRun?.jobs,
      ).toHaveLength(1)
    }),
  )

  it.effect("forget keeps the current repo", () =>
    Effect.sync(() => {
      const state = stateOf({
        repos: [entry({ repo: repo("a/cur"), current: true }), entry()],
      })

      expect(
        state
          .forget(repo("a/cur"))
          .forget(repo())
          .repos.map(e => e.repo.path),
      ).toEqual(["a/cur"])
    }),
  )
})

describe("settledRuns", () => {
  const ci = (
    id: string,
    status: "running" | "success" | "failure",
    minutes = 0,
  ) =>
    run({
      ref: runRef(id),
      status,
      createdAt: new Date(T0.getTime() + minutes * 60_000),
    })

  it.effect(
    "reports runs that went from active to final, with the one before",
    () =>
      Effect.sync(() => {
        const before = [ci("2", "running", 10), ci("1", "failure", 0)]
        const after = [ci("2", "success", 10), ci("1", "failure", 0)]

        const [settled, ...rest] = settledRuns(before, after)

        expect(rest).toHaveLength(0)
        expect(settled?.run.ref.id).toBe(RunId.make("2"))
        expect(settled?.previous?.ref.id).toBe(RunId.make("1"))
      }),
  )

  it.effect("ignores new runs and runs that were already final", () =>
    Effect.sync(() => {
      expect(settledRuns([], [ci("1", "success")])).toHaveLength(0)
      expect(
        settledRuns([ci("1", "failure")], [ci("1", "failure")]),
      ).toHaveLength(0)
    }),
  )
})

describe("backoff", () => {
  it.effect("doubles from 10 s and stops at 5 min", () =>
    Effect.sync(() =>
      expect([1, 2, 3, 6, 20].map(n => Duration.toSeconds(backoff(n)))).toEqual(
        [10, 20, 40, 300, 300],
      ),
    ),
  )
})
