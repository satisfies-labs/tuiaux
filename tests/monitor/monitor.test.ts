import { describe, expect } from "bun:test"
import {
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Ref,
  Stream,
  SubscriptionRef,
} from "effect"
import { TestClock } from "effect/testing"

import {
  AuthMissing,
  Network,
  NotFound,
  RateLimited,
  type RepoRef,
  type Run,
} from "../../src/domain"
import {
  Monitor,
  type MonitorState,
  RepoHealth,
  type RunSettled,
} from "../../src/monitor"
import {
  AppConfig,
  CachedRuns,
  DEFAULT_CONFIG,
  type LocalRepo,
  RepoHistory,
  RunCache,
} from "../../src/platform"
import { FakeCi, checkout, fakeGit } from "../fakes/ci"
import { memoryStorage } from "../fakes/storage"
import { T0, job, repo, run, runRef } from "../support/domain"
import { layer } from "../support/effect"

const CURRENT = repo("acme/api")
const OTHER = repo("acme/web")
const IN_CHECKOUT = checkout("git@github.com:acme/api.git")

const services = (local: Option.Option<LocalRepo>) =>
  Layer.mergeAll(
    FakeCi.layer,
    fakeGit(local),
    memoryStorage,
    Layer.succeed(AppConfig, {
      config: DEFAULT_CONFIG,
      issues: [],
      path: "/home/test/.config/tuiaux/config.toml",
    }),
  )

/** Builds the Monitor in the test's scope (after the test has seeded history and cache). */
const start = Layer.build(Monitor.layer("/work/repo")).pipe(
  Effect.map(context => Context.get(context, Monitor)),
)

/** Waits until the state satisfies `predicate`; the forked pollers run meanwhile. */
const waitFor = (
  monitor: Monitor["Service"],
  predicate: (state: MonitorState) => boolean,
) =>
  SubscriptionRef.changes(monitor.state).pipe(
    Stream.filter(predicate),
    Stream.runHead,
    Effect.map(Option.getOrThrow),
  )

const entryOf = (state: MonitorState, target: RepoRef) =>
  state.repos.find(entry => entry.repo.key === target.key)

const fresh = (target: RepoRef) => (state: MonitorState) =>
  entryOf(state, target)?.stale === false

const failing = (target: RepoRef) => (state: MonitorState) =>
  RepoHealth.$is("Failing")(entryOf(state, target)?.health ?? RepoHealth.Ok())

/** Runs `f` with the scripted CI. */
const withCi = <A, E>(f: (ci: FakeCi["Service"]) => Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    return yield* f(yield* FakeCi)
  })

/** Moves the clock and lets the woken fibers run. */
const advance = (duration: Duration.Input) =>
  TestClock.adjust(duration).pipe(
    Effect.andThen(Effect.yieldNow),
    Effect.andThen(Effect.yieldNow),
  )

const pollCount = (target: RepoRef) =>
  withCi(ci => ci.polled).pipe(
    Effect.map(keys => keys.filter(key => key === target.key).length),
  )

const runs = (target: RepoRef, ...result: ReadonlyArray<Run>) =>
  withCi(ci => ci.runs(target, Effect.succeed(result)))

const remember = (target: RepoRef, cached: ReadonlyArray<Run> = []) =>
  Effect.gen(function* () {
    yield* (yield* RepoHistory).remember({ repo: target })
    yield* (yield* RunCache).write(
      new CachedRuns({ repo: target, runs: cached, fetchedAt: T0 }),
    )
  })

const running = run({ ref: runRef("1", CURRENT), status: "running" })
const passed = run({ ref: runRef("1", CURRENT), status: "success" })

layer(services(IN_CHECKOUT))(it => {
  describe("repo set", () => {
    it.effect(
      "current repo first, then remembered repos drawn from the cache",
      () =>
        Effect.gen(function* () {
          yield* remember(OTHER, [run({ ref: runRef("9", OTHER) })])
          const monitor = yield* start
          const state = yield* SubscriptionRef.get(monitor.state)

          expect(state.inGitRepo).toBe(true)
          expect(state.repos.map(entry => entry.repo.path)).toEqual([
            "acme/api",
            "acme/web",
          ])
          expect(entryOf(state, OTHER)).toMatchObject({
            current: false,
            stale: true,
          })
          expect(entryOf(state, OTHER)?.runs).toHaveLength(1)
        }),
    )

    it.effect("forget drops a remembered repo but keeps the current one", () =>
      Effect.gen(function* () {
        yield* remember(OTHER)
        const monitor = yield* start

        yield* monitor.forget(OTHER)
        yield* monitor.forget(CURRENT)
        const state = yield* SubscriptionRef.get(monitor.state)

        expect(state.repos.map(entry => entry.repo.path)).toEqual(["acme/api"])
        expect(
          (yield* (yield* RepoHistory).list).map(entry => entry.repo.path),
        ).toEqual([])
      }),
    )
  })

  describe("polling", () => {
    it.effect("polls the current repo, then caches and remembers it", () =>
      Effect.gen(function* () {
        yield* runs(CURRENT, passed)
        const monitor = yield* start
        const state = yield* waitFor(monitor, fresh(CURRENT))

        expect(entryOf(state, CURRENT)?.runs).toEqual([passed])
        expect(Option.isSome(yield* (yield* RunCache).read(CURRENT))).toBe(true)
        expect(yield* (yield* RepoHistory).list).toMatchObject([
          { repo: CURRENT, localPath: "/work/repo", lastBranch: "main" },
        ])
      }),
    )

    it.effect("every 5 s while a run is active, every 30 s otherwise", () =>
      Effect.gen(function* () {
        yield* runs(CURRENT, running)
        const monitor = yield* start

        yield* waitFor(monitor, fresh(CURRENT))
        yield* advance("5 seconds")
        expect(yield* pollCount(CURRENT)).toBe(2)

        yield* runs(CURRENT, passed)
        yield* advance("5 seconds")
        yield* advance("5 seconds")
        expect(yield* pollCount(CURRENT)).toBe(3)

        yield* advance("25 seconds")
        expect(yield* pollCount(CURRENT)).toBe(4)
      }),
    )

    it.effect("a cold repo isn't polled, unless it's focused", () =>
      Effect.gen(function* () {
        yield* remember(OTHER)
        const monitor = yield* start

        yield* advance("1 minute")
        expect(yield* pollCount(OTHER)).toBe(0)

        yield* monitor.focusRepo(OTHER)
        yield* waitFor(monitor, fresh(OTHER))
        yield* monitor.focusRepo(undefined)
        const polled = yield* pollCount(OTHER)

        yield* advance("5 minutes")
        expect(yield* pollCount(OTHER)).toBe(polled)
      }),
    )

    it.effect("a cached active run keeps its repo hot", () =>
      Effect.gen(function* () {
        yield* remember(OTHER, [
          run({ ref: runRef("9", OTHER), status: "running" }),
        ])
        const monitor = yield* start

        yield* waitFor(monitor, fresh(OTHER))
        expect(yield* pollCount(OTHER)).toBe(1)
      }),
    )
  })

  describe("settled", () => {
    const collect = (monitor: Monitor["Service"]) =>
      Effect.gen(function* () {
        const seen = yield* Ref.make<ReadonlyArray<RunSettled>>([])

        yield* monitor.settled.pipe(
          Stream.runForEach(event => Ref.update(seen, all => [...all, event])),
          Effect.forkScoped,
        )
        yield* Effect.yieldNow

        return seen
      })

    it.effect("announces a run that settles while watched", () =>
      Effect.gen(function* () {
        yield* runs(CURRENT, running)
        const monitor = yield* start
        const seen = yield* collect(monitor)

        yield* waitFor(monitor, fresh(CURRENT))
        yield* runs(CURRENT, passed)
        yield* advance("5 seconds")

        expect((yield* Ref.get(seen)).map(event => event.run)).toEqual([passed])
      }),
    )

    it.effect(
      "stays quiet about runs that settled while tuiaux was closed",
      () =>
        Effect.gen(function* () {
          yield* (yield* RunCache).write(
            new CachedRuns({ repo: CURRENT, runs: [running], fetchedAt: T0 }),
          )
          yield* runs(CURRENT, passed)
          const monitor = yield* start
          const seen = yield* collect(monitor)

          yield* waitFor(monitor, fresh(CURRENT))
          yield* advance("30 seconds")

          expect(yield* Ref.get(seen)).toEqual([])
        }),
    )
  })

  describe("errors", () => {
    it.effect("transient errors back off 10 s, then 20 s, then recover", () =>
      Effect.gen(function* () {
        yield* withCi(ci =>
          ci.runs(
            CURRENT,
            Effect.fail(
              new Network({
                kind: "github",
                host: "github.com",
                cause: "reset",
              }),
            ),
          ),
        )
        const monitor = yield* start
        const first = yield* waitFor(monitor, failing(CURRENT))

        expect(entryOf(first, CURRENT)?.health).toMatchObject({
          nextRetryAt: new Date(10_000),
        })

        yield* advance("10 seconds")
        expect(yield* pollCount(CURRENT)).toBe(2)

        yield* runs(CURRENT, passed)
        yield* advance("20 seconds")
        const recovered = yield* waitFor(monitor, fresh(CURRENT))

        expect(entryOf(recovered, CURRENT)?.health).toEqual(RepoHealth.Ok())
        expect(yield* pollCount(CURRENT)).toBe(3)
      }),
    )

    it.effect("a rate limit pauses the host until it resets", () =>
      Effect.gen(function* () {
        yield* withCi(ci =>
          ci.runs(
            CURRENT,
            Effect.fail(
              new RateLimited({
                kind: "github",
                host: "github.com",
                resetAt: new Date(60_000),
              }),
            ),
          ),
        )
        const monitor = yield* start

        yield* waitFor(monitor, state => state.hostIssues.length === 1)
        yield* advance("30 seconds")
        expect(yield* pollCount(CURRENT)).toBe(1)

        yield* runs(CURRENT, passed)
        yield* advance("30 seconds")
        const resumed = yield* waitFor(monitor, fresh(CURRENT))

        expect(resumed.hostIssues).toEqual([])
      }),
    )

    it.effect("missing credentials stop the host until refresh", () =>
      Effect.gen(function* () {
        yield* withCi(ci =>
          ci.runs(
            CURRENT,
            Effect.fail(
              new AuthMissing({
                kind: "github",
                host: "github.com",
                reason: "not-logged-in",
                hint: "Run `gh auth login`.",
              }),
            ),
          ),
        )
        const monitor = yield* start

        yield* waitFor(monitor, state => state.hostIssues.length === 1)
        yield* advance("10 minutes")
        expect(yield* pollCount(CURRENT)).toBe(1)

        yield* runs(CURRENT, passed)
        yield* monitor.refresh
        const resumed = yield* waitFor(monitor, fresh(CURRENT))

        expect(resumed.hostIssues).toEqual([])
        expect(yield* pollCount(CURRENT)).toBe(2)
      }),
    )

    it.effect("a repo that no longer exists stops but stays listed", () =>
      Effect.gen(function* () {
        yield* withCi(ci =>
          ci.runs(
            CURRENT,
            Effect.fail(new NotFound({ repo: CURRENT, resource: "repo" })),
          ),
        )
        const monitor = yield* start

        yield* waitFor(monitor, failing(CURRENT))
        yield* advance("10 minutes")

        expect(yield* pollCount(CURRENT)).toBe(1)
        expect(
          (yield* SubscriptionRef.get(monitor.state)).repos.map(
            e => e.repo.path,
          ),
        ).toEqual(["acme/api"])
      }),
    )
  })

  describe("focused run", () => {
    it.effect("polls jobs while the run is active, then stops", () =>
      Effect.gen(function* () {
        const ref = runRef("1", CURRENT)

        yield* runs(CURRENT, running)
        yield* withCi(ci =>
          ci.jobs(ref, Effect.succeed([job({ status: "running" })])),
        )
        const monitor = yield* start

        yield* waitFor(monitor, fresh(CURRENT))
        yield* monitor.focusRun(ref)

        const focused = yield* waitFor(
          monitor,
          state => (state.focusedRun?.jobs.length ?? 0) === 1,
        )

        expect(focused.focusedRun?.run).toEqual(ref)

        yield* runs(CURRENT, passed)
        yield* withCi(ci =>
          ci.jobs(ref, Effect.succeed([job({ status: "success" })])),
        )
        yield* advance("5 seconds")
        yield* advance("5 seconds")
        const settledJobs = yield* withCi(ci => ci.polledJobs)

        yield* advance("1 minute")
        expect((yield* withCi(ci => ci.polledJobs)).length).toBe(
          settledJobs.length,
        )

        yield* monitor.focusRun(undefined)
        expect(
          (yield* SubscriptionRef.get(monitor.state)).focusedRun,
        ).toBeUndefined()
      }),
    )
    it.effect("refresh fetches the jobs again, even during a backoff", () =>
      Effect.gen(function* () {
        const ref = runRef("1", CURRENT)

        yield* runs(CURRENT, running)
        yield* withCi(ci =>
          ci.jobs(
            ref,
            Effect.fail(
              new Network({
                kind: "github",
                host: "github.com",
                cause: "reset",
              }),
            ),
          ),
        )
        const monitor = yield* start

        yield* monitor.focusRun(ref)
        yield* waitFor(monitor, state => state.focusedRun?.error !== undefined)
        yield* withCi(ci => ci.jobs(ref, Effect.succeed([job()])))
        yield* monitor.refresh

        const refreshed = yield* waitFor(
          monitor,
          state => (state.focusedRun?.jobs.length ?? 0) === 1,
        )

        expect(refreshed.focusedRun?.error).toBeUndefined()
      }),
    )
  })
})

layer(services(Option.none()))(it => {
  it.effect("outside a git repo: remembered repos only, none polled", () =>
    Effect.gen(function* () {
      yield* remember(OTHER)
      const monitor = yield* start

      yield* advance("1 minute")
      const state = yield* SubscriptionRef.get(monitor.state)

      expect(state.inGitRepo).toBe(false)
      expect(state.repos.map(entry => entry.repo.path)).toEqual(["acme/web"])
      expect(yield* withCi(ci => ci.polled)).toEqual([])
    }),
  )
})
