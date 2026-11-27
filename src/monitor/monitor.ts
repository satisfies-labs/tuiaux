import {
  Array as Arr,
  Clock,
  Context,
  Duration,
  Effect,
  Equal,
  FiberHandle,
  FiberMap,
  HashSet,
  Layer,
  Match,
  Option,
  PubSub,
  Ref,
  Stream,
  SubscriptionRef,
} from "effect"

import {
  type ProviderError,
  type RepoKey,
  type RepoRef,
  type Run,
  type RunRef,
  isActive,
} from "../domain"
import { AppConfig, CachedRuns, RepoHistory, RunCache } from "../platform"
import { Providers } from "../providers"
import { type Next, poll } from "./poll"
import { loadRepos } from "./repos"
import {
  type HostIssue,
  type MonitorState,
  type RunSettled,
  backoff,
  hostKey,
  settledRuns,
} from "./state"

const RUN_LIMIT = 20

const sameRuns = Arr.makeEquivalence(Equal.equals)

const now = Effect.map(Clock.currentTimeMillis, millis => new Date(millis))

const stop: Next = Option.none()

/**
 * Keeps the CI picture of the listed repos up to date and announces settled runs. Polls only hot
 * repos, one fiber each, reconciled on every state change. The policy lives in `MonitorState`.
 */
export class Monitor extends Context.Service<
  Monitor,
  {
    readonly state: SubscriptionRef.SubscriptionRef<MonitorState>
    readonly settled: Stream.Stream<RunSettled>
    /** The repo under the cursor: hot while focused. */
    readonly focusRepo: (repo: RepoRef | undefined) => Effect.Effect<void>
    /** The run open in the detail view: its jobs are polled while it's active. */
    readonly focusRun: (run: RunRef | undefined) => Effect.Effect<void>
    /** Polls everything now and retries stopped hosts and repos. */
    readonly refresh: Effect.Effect<void>
    readonly forget: (repo: RepoRef) => Effect.Effect<void>
  }
>()("tuiaux/Monitor") {
  static readonly layer = (cwd: string) =>
    Layer.effect(
      Monitor,
      Effect.gen(function* () {
        const intervals = (yield* AppConfig).config.refresh
        const providers = yield* Providers
        const history = yield* RepoHistory
        const cache = yield* RunCache
        const { local, current, state: initial } = yield* loadRepos(cwd)

        const state = yield* SubscriptionRef.make(initial)
        const settled = yield* PubSub.unbounded<RunSettled>()
        const remembered = yield* Ref.make(HashSet.empty<RepoKey>())
        const pollers = yield* FiberMap.make<RepoKey>()
        const hostTimers = yield* FiberMap.make<string>()
        const jobsPoller = yield* FiberHandle.make()

        const update = (f: (state: MonitorState) => MonitorState) =>
          SubscriptionRef.update(state, f)

        const every = (active: boolean): Next =>
          Option.some(
            Duration.seconds(active ? intervals.active : intervals.idle),
          )

        const rememberOnce = (repo: RepoRef) =>
          Effect.gen(function* () {
            if (HashSet.has(yield* Ref.get(remembered), repo.key)) return

            const checkout = Option.exists(current, c => c.key === repo.key)
              ? Option.getOrUndefined(local)
              : undefined

            yield* history.remember({
              repo,
              localPath: checkout?.root,
              branch: checkout && Option.getOrUndefined(checkout.branch),
            })
            yield* Ref.update(remembered, HashSet.add(repo.key))
          })

        // Side effects before the state update, which may make the repo cold and interrupt us.
        const recordRuns = (repo: RepoRef, runs: ReadonlyArray<Run>) =>
          Effect.gen(function* () {
            const at = yield* now
            const previous = (yield* SubscriptionRef.get(state)).entry(repo)

            // Only this session's data: runs that settled while tuiaux was closed are no news.
            if (previous !== undefined && !previous.stale)
              yield* PubSub.publishAll(
                settled,
                settledRuns(previous.runs, runs),
              )

            if (previous === undefined || !sameRuns(previous.runs, runs))
              yield* cache.write(new CachedRuns({ repo, runs, fetchedAt: at }))

            if (runs.length > 0) yield* rememberOnce(repo)

            yield* update(s => s.fetched(repo, runs, at))
          }).pipe(Effect.uninterruptible)

        const retry = (repo: RepoRef, error: ProviderError, failures: number) =>
          Effect.gen(function* () {
            const at = yield* now
            const delay = backoff(failures)
            const retryAt = new Date(at.getTime() + Duration.toMillis(delay))

            yield* update(s => s.failing(repo, error, at, retryAt))

            return Option.some(delay)
          })

        const giveUp = (repo: RepoRef, error: ProviderError) =>
          now.pipe(
            Effect.flatMap(at =>
              update(s => s.failing(repo, error, at, undefined)),
            ),
            Effect.as(stop),
          )

        /** A rate limit pauses the host until its reset; a credentials problem until refresh. */
        const blockHost = (repo: RepoRef, issue: HostIssue) =>
          Effect.gen(function* () {
            const at = yield* now

            const resumeAt = Match.valueTags(issue, {
              RateLimited: limited => limited.resetAt,
              AuthMissing: () => undefined,
              Unauthorized: () => undefined,
            })

            yield* update(s =>
              s.failing(repo, issue, at, resumeAt).block(issue),
            )

            if (resumeAt !== undefined)
              yield* FiberMap.run(
                hostTimers,
                hostKey(issue),
                Effect.sleep(
                  Duration.millis(resumeAt.getTime() - at.getTime()),
                ).pipe(Effect.andThen(update(s => s.unblock(issue)))),
              )

            return stop
          })

        const pollRepo = (repo: RepoRef) =>
          poll(
            providers
              .get(repo.kind)
              .listRuns(repo, { branch: undefined, limit: RUN_LIMIT }),
            {
              onSuccess: runs =>
                recordRuns(repo, runs).pipe(
                  Effect.as(every(runs.some(run => isActive(run.status)))),
                ),
              onFailure: (error, failures) =>
                Match.valueTags(error, {
                  AuthMissing: issue => blockHost(repo, issue),
                  Unauthorized: issue => blockHost(repo, issue),
                  RateLimited: issue => blockHost(repo, issue),
                  NotFound: missing =>
                    missing.resource === "repo"
                      ? giveUp(repo, missing)
                      : retry(repo, missing, failures),
                  Network: transient => retry(repo, transient, failures),
                  Unexpected: transient => retry(repo, transient, failures),
                }),
            },
          )

        const pollJobs = (run: RunRef) =>
          poll(providers.get(run.repo.kind).listJobs(run), {
            onSuccess: jobs =>
              SubscriptionRef.updateAndGet(state, s =>
                s.withJobs(run, jobs),
              ).pipe(
                Effect.map(s =>
                  jobs.some(job => isActive(job.status)) || s.isRunActive(run)
                    ? every(true)
                    : stop,
                ),
              ),
            onFailure: (error, failures) =>
              update(s => s.withJobsError(run, error)).pipe(
                Effect.as(Option.some(backoff(failures))),
              ),
          })

        // Reads the latest state, not the triggering change: a lagging one could revive a stopped poller.
        const reconcile = Effect.gen(function* () {
          const hot = (yield* SubscriptionRef.get(state)).hotRepos
          const hotKeys = HashSet.fromIterable(hot.map(repo => repo.key))

          const cold = Array.from(pollers, ([key]) => key).filter(
            key => !HashSet.has(hotKeys, key),
          )

          yield* Effect.forEach(cold, key => FiberMap.remove(pollers, key), {
            discard: true,
          })
          yield* Effect.forEach(
            hot,
            repo =>
              FiberMap.run(pollers, repo.key, pollRepo(repo), {
                onlyIfMissing: true,
              }),
            { discard: true },
          )
        })

        yield* SubscriptionRef.changes(state).pipe(
          Stream.runForEach(() => reconcile),
          Effect.forkScoped,
        )

        const watchJobs = (run: RunRef) =>
          FiberHandle.run(jobsPoller, pollJobs(run)).pipe(Effect.asVoid)

        return {
          state,
          settled: Stream.fromPubSub(settled),

          focusRepo: repo => update(s => s.focusRepo(repo)),

          focusRun: run =>
            update(s => s.focusRun(run)).pipe(
              Effect.andThen(
                run === undefined
                  ? FiberHandle.clear(jobsPoller)
                  : watchJobs(run),
              ),
            ),

          refresh: Effect.gen(function* () {
            yield* FiberMap.clear(hostTimers)
            yield* FiberMap.clear(pollers)

            const { focusedRun } = yield* SubscriptionRef.updateAndGet(
              state,
              s => s.refreshed(),
            )

            if (focusedRun !== undefined) yield* watchJobs(focusedRun.run)
          }),

          forget: repo =>
            Effect.all(
              [
                history.forget(repo),
                cache.remove(repo),
                Ref.update(remembered, HashSet.remove(repo.key)),
                update(s => s.forget(repo)),
              ],
              { discard: true },
            ),
        }
      }),
    )
}
