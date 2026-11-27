import { Equal, Match } from "effect"

import { type Job, type Run, completion, elapsed } from "../../domain"
import type { FocusedRun } from "../../monitor"
import {
  Panel,
  ProgressBar,
  StatusDot,
  describeError,
  formatAge,
  formatDuration,
  useText,
  useTheme,
} from "../../ui"

const NAME = 20
const LABEL = 8
const TIME = 6

const labelOf = (job: Job): string =>
  Match.value(job.status).pipe(
    Match.when("running", () =>
      job.progress === undefined
        ? "running"
        : `${Math.round(job.progress * 100)}%`,
    ),
    Match.whenOr("success", "failure", () => "done"),
    Match.orElse(status => status),
  )

const JobRow = ({
  job,
  bar,
  now,
}: {
  readonly job: Job
  readonly bar: number
  readonly now: Date
}) => {
  const theme = useTheme()
  const { fit } = useText()
  const name = job.stage === undefined ? job.name : `${job.stage} › ${job.name}`

  return (
    <text wrapMode="none">
      <StatusDot status={job.status} />
      <span fg={theme.text}>{` ${fit(name, NAME)} `}</span>
      <ProgressBar value={completion(job)} width={bar} status={job.status} />
      <span fg={theme.muted}>{` ${fit(labelOf(job), LABEL)}`}</span>
      <span fg={theme.muted}>
        {formatDuration(elapsed(job, now)).padStart(TIME)}
      </span>
    </text>
  )
}

/** The jobs of the selected run, polled by the Monitor while it's the focused run. */
export const JobsPanel = ({
  run,
  focused,
  width,
  height,
  now,
}: {
  readonly run: Run | undefined
  readonly focused: FocusedRun | undefined
  readonly width: number
  readonly height: number
  readonly now: Date
}) => {
  const theme = useTheme()

  const ours =
    run !== undefined &&
    focused !== undefined &&
    Equal.equals(focused.run, run.ref)

  const jobs = ours ? focused.jobs : []
  // Dot, spaces around the name, label and time columns.
  const bar = Math.max(4, width - 4 - NAME - LABEL - TIME - 4)

  const title =
    run === undefined
      ? "Jobs"
      : `Jobs · ${run.workflow} #${run.number} · ${run.commitSha.slice(0, 7)}`

  return (
    <Panel title={title} height={height}>
      {run !== undefined && (
        <text wrapMode="none" fg={theme.muted}>
          {[
            run.status,
            `${run.event} on ${run.branch}`,
            ...(run.actor === undefined ? [] : [`by ${run.actor}`]),
            `created ${formatAge(run.createdAt, now)} ago`,
          ].join("  ·  ")}
        </text>
      )}
      {ours && focused.error !== undefined && (
        <text wrapMode="none" fg={theme.failure}>
          {describeError(focused.error)}
        </text>
      )}
      {jobs.slice(0, Math.max(0, height - 3)).map(job => (
        <JobRow key={job.ref.id} job={job} bar={bar} now={now} />
      ))}
      {run !== undefined && jobs.length === 0 && (
        <text fg={theme.muted}>{ours ? "No jobs yet." : "Loading jobs…"}</text>
      )}
    </Panel>
  )
}
