import { Equal, Match } from "effect"

import { type Job, type Run, completion, elapsed } from "../../domain"
import type { FocusedRun } from "../../monitor"
import {
  type Column,
  Panel,
  ProgressBar,
  StatusDot,
  Table,
  describeError,
  formatDuration,
  panelInner,
  useTheme,
} from "../../ui"

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

const columns = (now: Date): ReadonlyArray<Column<Job>> => [
  {
    id: "name",
    width: 20,
    priority: 10,
    value: job =>
      job.stage === undefined ? job.name : `${job.stage} › ${job.name}`,
  },
  {
    id: "bar",
    width: 0,
    flex: true,
    min: 4,
    priority: 5,
    value: () => "",
    cell: (job, width) => (
      <ProgressBar value={completion(job)} width={width} status={job.status} />
    ),
  },
  {
    id: "label",
    width: 8,
    priority: 6,
    value: labelOf,
    tone: () => "muted",
  },
  {
    id: "time",
    width: 6,
    align: "right",
    priority: 8,
    value: job => formatDuration(elapsed(job, now)),
    tone: () => "muted",
  },
]

/** Rows the jobs panel wants: its borders, one row per job, room for an error line. */
export const jobsPanelHeight = (jobs: number, content: number): number =>
  Math.min(Math.max(jobs + 3, 5), Math.floor(content / 2))

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

  const title =
    run === undefined
      ? "Jobs"
      : [
          `Jobs · ${run.workflow} #${run.number}`,
          run.commitSha.slice(0, 7),
          `${run.event} on ${run.branch}`,
          ...(run.actor === undefined ? [] : [`by ${run.actor}`]),
        ].join(" · ")

  return (
    <Panel title={title} width={width} height={height}>
      {ours && focused.error !== undefined && (
        <text wrapMode="none" fg={theme.failure}>
          {describeError(focused.error)}
        </text>
      )}
      <Table
        columns={columns(now)}
        rows={jobs}
        rowKey={job => job.ref.id}
        lead={job => <StatusDot status={job.status} now={now} />}
        focused={false}
        width={panelInner(width)}
        height={Math.max(0, height - 2)}
      />
      {run !== undefined && jobs.length === 0 && (
        <text fg={theme.muted}>{ours ? "No jobs yet." : "Loading jobs…"}</text>
      )}
    </Panel>
  )
}
