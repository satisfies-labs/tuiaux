import { Duration, Match, Option, Schema } from "effect"

import { JobRef, RunRef } from "./refs"
import { Status, isActive } from "./status"

const Timestamps = {
  startedAt: Schema.UndefinedOr(Schema.Date),
  finishedAt: Schema.UndefinedOr(Schema.Date),
}

/** An ordered part of a job. */
export class Step extends Schema.Class<Step, { readonly brand: unique symbol }>(
  "Step",
)({
  name: Schema.String,
  status: Status,
  ...Timestamps,
}) {}

/** A unit of work inside a run. */
export class Job extends Schema.Class<Job, { readonly brand: unique symbol }>(
  "Job",
)({
  ref: JobRef,
  name: Schema.String,
  /** GitLab stage. undefined on GitHub. */
  stage: Schema.UndefinedOr(Schema.String),
  status: Status,
  ...Timestamps,
  /** 0..1 when the provider can estimate it. */
  progress: Schema.UndefinedOr(
    Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  ),
  steps: Schema.Array(Step),
  url: Schema.UndefinedOr(Schema.String),
}) {}

/** One execution of a pipeline for a commit: a GitHub workflow run or a GitLab pipeline. */
export class Run extends Schema.Class<Run, { readonly brand: unique symbol }>(
  "Run",
)({
  ref: RunRef,
  /** Workflow name (GitHub) or pipeline name/source (GitLab). */
  workflow: Schema.String,
  /** Human run number (`#412`). */
  number: Schema.Int,
  status: Status,
  branch: Schema.String,
  commitSha: Schema.String,
  /** First line of the commit message, when the provider returns it. */
  commitMessage: Schema.UndefinedOr(Schema.String),
  /** What triggered the run: `push`, `pull_request`, `schedule`, … */
  event: Schema.String,
  actor: Schema.UndefinedOr(Schema.String),
  createdAt: Schema.Date,
  ...Timestamps,
  url: Schema.String,
}) {}

interface Timed {
  readonly status: Status
  readonly startedAt: Date | undefined
  readonly finishedAt: Date | undefined
}

const between = (start: Date | undefined, end: Date | undefined) =>
  start === undefined || end === undefined
    ? Option.none<Duration.Duration>()
    : Option.some(Duration.millis(Math.max(0, end.getTime() - start.getTime())))

/** Total time of a finished run, job or step. None without both ends (a step that was skipped). */
export const duration = (item: Timed): Option.Option<Duration.Duration> =>
  between(item.startedAt, item.finishedAt)

/** Time spent so far while active, then its total duration. Never negative (clock skew). */
export const elapsed = (
  item: Timed,
  now: Date,
): Option.Option<Duration.Duration> =>
  isActive(item.status) ? between(item.startedAt, now) : duration(item)

/** A run has settled when it goes from active to a final status between two observations. */
export const hasSettled = (previous: Run | undefined, current: Run): boolean =>
  previous !== undefined &&
  isActive(previous.status) &&
  !isActive(current.status)

/** How far along a job is, 0..1: done once settled, its reported progress while running. */
export const completion = (job: Job): number =>
  Match.value(job.status).pipe(
    Match.when("running", () => job.progress ?? 0),
    Match.when("queued", () => 0),
    Match.orElse(() => 1),
  )
