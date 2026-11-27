import { Data, Duration, Equal, Predicate } from "effect"

import {
  type AuthMissing,
  type Job,
  type ProviderError,
  type ProviderKind,
  type RateLimited,
  type RepoKey,
  type RepoRef,
  type Run,
  type RunRef,
  type Unauthorized,
  hasSettled,
  isActive,
} from "../domain"

/** Whether the last fetch of a repo worked; when failing, when it's retried (undefined: on refresh). */
export type RepoHealth = Data.TaggedEnum<{
  Ok: {}
  Failing: {
    readonly error: ProviderError
    readonly since: Date
    readonly nextRetryAt: Date | undefined
  }
}>

export const RepoHealth = Data.taggedEnum<RepoHealth>()

/** A problem affecting every repo of a host at once. */
export type HostIssue = AuthMissing | Unauthorized | RateLimited

interface Host {
  readonly kind: ProviderKind
  readonly host: string
}

const sameHost = (a: Host, b: Host) => a.kind === b.kind && a.host === b.host

export const hostKey = (host: Host) => `${host.kind}:${host.host}`

/** An active run reached a final status. */
export interface RunSettled {
  readonly run: Run
  /** The previous settled run of the same workflow and branch, when listed (tells "recovered"). */
  readonly previous: Run | undefined
}

/** The run open in the detail view, with its jobs. */
export interface FocusedRun {
  readonly run: RunRef
  readonly jobs: ReadonlyArray<Job>
  readonly error: ProviderError | undefined
}

/** One row of the repo list. */
export class RepoEntry extends Data.Class<{
  readonly repo: RepoRef
  /** The repo tuiaux was started in: listed first and always hot. */
  readonly current: boolean
  /** Newest first. */
  readonly runs: ReadonlyArray<Run>
  readonly fetchedAt: Date | undefined
  /** `runs` comes from the disk cache, not from this session. */
  readonly stale: boolean
  readonly health: RepoHealth
}> {
  get hasActiveRun(): boolean {
    return this.runs.some(run => isActive(run.status))
  }

  /** Gone, or invisible with this token: not polled again until refresh. */
  get isGone(): boolean {
    return (
      RepoHealth.$is("Failing")(this.health) &&
      Predicate.isTagged(this.health.error, "NotFound") &&
      this.health.error.resource === "repo"
    )
  }

  fetched(runs: ReadonlyArray<Run>, at: Date): RepoEntry {
    return new RepoEntry({
      ...this,
      runs,
      fetchedAt: at,
      stale: false,
      health: RepoHealth.Ok(),
    })
  }

  failing(error: ProviderError, at: Date, nextRetryAt: Date | undefined) {
    const since = RepoHealth.$is("Failing")(this.health)
      ? this.health.since
      : at

    return new RepoEntry({
      ...this,
      health: RepoHealth.Failing({ error, since, nextRetryAt }),
    })
  }
}

/** Everything the Monitor knows. Immutable: each change returns a new state. */
export class MonitorState extends Data.Class<{
  readonly inGitRepo: boolean
  /** Current repo first, then remembered repos, most recent first. */
  readonly repos: ReadonlyArray<RepoEntry>
  readonly hostIssues: ReadonlyArray<HostIssue>
  readonly focusedRepo: RepoKey | undefined
  readonly focusedRun: FocusedRun | undefined
}> {
  entry(repo: RepoRef): RepoEntry | undefined {
    return this.repos.find(entry => entry.repo.key === repo.key)
  }

  /**
   * Repos to poll: the current one, the focused one, and any with an active run (cached ones too, so
   * a run can't stay "running" forever). Never a gone repo or one whose host has an issue.
   */
  get hotRepos(): ReadonlyArray<RepoRef> {
    return this.repos.flatMap(entry =>
      !entry.isGone &&
      !this.hostIssues.some(issue => sameHost(issue, entry.repo)) &&
      (entry.current ||
        entry.repo.key === this.focusedRepo ||
        entry.hasActiveRun)
        ? [entry.repo]
        : [],
    )
  }

  isRunActive(run: RunRef): boolean {
    return (
      this.entry(run.repo)?.runs.some(
        candidate =>
          Equal.equals(candidate.ref, run) && isActive(candidate.status),
      ) ?? false
    )
  }

  fetched(repo: RepoRef, runs: ReadonlyArray<Run>, at: Date): MonitorState {
    return this.updateEntry(repo, entry => entry.fetched(runs, at)).unblock(
      repo,
    )
  }

  failing(
    repo: RepoRef,
    error: ProviderError,
    at: Date,
    nextRetryAt: Date | undefined,
  ): MonitorState {
    return this.updateEntry(repo, entry =>
      entry.failing(error, at, nextRetryAt),
    )
  }

  block(issue: HostIssue): MonitorState {
    return new MonitorState({
      ...this,
      hostIssues: [...this.unblock(issue).hostIssues, issue],
    })
  }

  unblock(host: Host): MonitorState {
    return new MonitorState({
      ...this,
      hostIssues: this.hostIssues.filter(issue => !sameHost(issue, host)),
    })
  }

  focusRepo(repo: RepoRef | undefined): MonitorState {
    return new MonitorState({ ...this, focusedRepo: repo?.key })
  }

  focusRun(run: RunRef | undefined): MonitorState {
    return new MonitorState({
      ...this,
      focusedRun:
        run === undefined ? undefined : { run, jobs: [], error: undefined },
    })
  }

  withJobs(run: RunRef, jobs: ReadonlyArray<Job>): MonitorState {
    return this.updateFocused(run, () => ({ run, jobs, error: undefined }))
  }

  /** Keeps the last jobs shown, with the error. */
  withJobsError(run: RunRef, error: ProviderError): MonitorState {
    return this.updateFocused(run, focused => ({ ...focused, error }))
  }

  /** After a manual refresh: no host issue, no failing repo. */
  refreshed(): MonitorState {
    return new MonitorState({
      ...this,
      hostIssues: [],
      repos: this.repos.map(entry =>
        RepoHealth.$is("Failing")(entry.health)
          ? new RepoEntry({ ...entry, health: RepoHealth.Ok() })
          : entry,
      ),
    })
  }

  /** Drops a remembered repo; the current repo stays listed. */
  forget(repo: RepoRef): MonitorState {
    return new MonitorState({
      ...this,
      repos: this.repos.filter(
        entry => entry.current || entry.repo.key !== repo.key,
      ),
    })
  }

  /** Only while `run` is still the focused one: a late answer for a closed run is dropped. */
  private updateFocused(
    run: RunRef,
    update: (focused: FocusedRun) => FocusedRun,
  ): MonitorState {
    const focused = this.focusedRun

    return focused !== undefined && Equal.equals(focused.run, run)
      ? new MonitorState({ ...this, focusedRun: update(focused) })
      : this
  }

  private updateEntry(
    repo: RepoRef,
    update: (entry: RepoEntry) => RepoEntry,
  ): MonitorState {
    return new MonitorState({
      ...this,
      repos: this.repos.map(entry =>
        entry.repo.key === repo.key ? update(entry) : entry,
      ),
    })
  }
}

export const isHostIssue = (error: ProviderError): error is HostIssue =>
  Predicate.isTagged(error, "AuthMissing") ||
  Predicate.isTagged(error, "Unauthorized") ||
  Predicate.isTagged(error, "RateLimited")

/** Runs that went from active to final between two fetches, with the run they follow. */
export const settledRuns = (
  before: ReadonlyArray<Run>,
  after: ReadonlyArray<Run>,
): ReadonlyArray<RunSettled> => {
  const previousById = new Map(before.map(run => [run.ref.id, run]))

  return after.flatMap(run =>
    hasSettled(previousById.get(run.ref.id), run)
      ? [
          {
            run,
            previous: after.find(
              other =>
                other.workflow === run.workflow &&
                other.branch === run.branch &&
                other.createdAt < run.createdAt &&
                !isActive(other.status),
            ),
          },
        ]
      : [],
  )
}

/** Wait after the n-th consecutive transient failure: 10 s, 20 s, 40 s… up to 5 min. */
export const backoff = (failures: number): Duration.Duration =>
  Duration.min(
    Duration.times(Duration.seconds(10), 2 ** Math.max(0, failures - 1)),
    Duration.minutes(5),
  )
