import { type Job, elapsed } from "../../domain"
import {
  type Column,
  Panel,
  StatusDot,
  Table,
  formatDuration,
  panelInner,
  plural,
} from "../../ui"

const columns = (now: Date): ReadonlyArray<Column<Job>> => [
  {
    id: "name",
    width: 0,
    flex: true,
    priority: 10,
    value: job =>
      job.stage === undefined ? job.name : `${job.stage} › ${job.name}`,
  },
  {
    id: "time",
    width: 8,
    align: "right",
    priority: 8,
    value: job => formatDuration(elapsed(job, now)),
    tone: () => "muted",
  },
]

/** The run's jobs; GitLab jobs are prefixed with their stage. */
export const JobList = ({
  jobs,
  selected,
  width,
  height,
  now,
}: {
  readonly jobs: ReadonlyArray<Job>
  readonly selected: Job | undefined
  readonly width: number
  readonly height: number
  readonly now: Date
}) => (
  <Panel
    title="Jobs"
    footer={jobs.length === 0 ? undefined : plural(jobs.length, "job")}
    focused
    width={width}
    height={height}
  >
    <Table
      columns={columns(now)}
      rows={jobs}
      rowKey={job => job.ref.id}
      lead={job => <StatusDot status={job.status} now={now} />}
      selected={selected?.ref.id}
      focused
      width={panelInner(width)}
      height={height - 2}
    />
  </Panel>
)
