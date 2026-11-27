import { Duration, Option, Schema } from "effect";
import { JobRef, RunRef } from "./refs";
import { isActive, Status } from "./status";

const Timestamps = {
  startedAt: Schema.optional(Schema.Date),
  finishedAt: Schema.optional(Schema.Date),
};

/** An ordered part of a job. */
export class Step extends Schema.Class<Step>("Step")({
  name: Schema.String,
  status: Status,
  ...Timestamps,
}) {}

/** A unit of work inside a run. */
export class Job extends Schema.Class<Job>("Job")({
  ref: JobRef,
  name: Schema.String,
  /** GitLab stage. Absent on GitHub. */
  stage: Schema.optional(Schema.String),
  status: Status,
  ...Timestamps,
  /** 0..1 when the provider can estimate it. */
  progress: Schema.optional(Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }))),
  steps: Schema.Array(Step),
  url: Schema.optional(Schema.String),
}) {}

/** One execution of a pipeline for a commit: a GitHub workflow run or a GitLab pipeline. */
export class Run extends Schema.Class<Run>("Run")({
  ref: RunRef,
  /** Workflow name (GitHub) or pipeline name/source (GitLab). */
  workflow: Schema.String,
  /** Human run number (`#412`). */
  number: Schema.Int,
  status: Status,
  branch: Schema.String,
  commitSha: Schema.String,
  /** First line of the commit message, when the provider returns it. */
  commitMessage: Schema.optional(Schema.String),
  /** What triggered the run: `push`, `pull_request`, `schedule`, … */
  event: Schema.String,
  actor: Schema.optional(Schema.String),
  createdAt: Schema.Date,
  ...Timestamps,
  url: Schema.String,
}) {}

/** Time spent so far (or in total, once finished). None when it hasn't started. */
export const elapsed = (
  item: { readonly startedAt?: Date | undefined; readonly finishedAt?: Date | undefined },
  now: Date,
): Option.Option<Duration.Duration> =>
  item.startedAt === undefined
    ? Option.none()
    : Option.some(
        Duration.millis(Math.max(0, (item.finishedAt ?? now).getTime() - item.startedAt.getTime())),
      );

/** A run has settled when it goes from active to a final status between two observations. */
export const hasSettled = (previous: Run | undefined, current: Run): boolean =>
  previous !== undefined && isActive(previous.status) && !isActive(current.status);
