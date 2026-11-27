import { type Job, elapsed } from "../../domain"
import {
  Panel,
  StatusDot,
  formatDuration,
  plural,
  useText,
  useTheme,
  visibleWindow,
} from "../../ui"

const TIME = 8

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
}) => {
  const theme = useTheme()
  const { fit } = useText()
  const cursor = jobs.findIndex(job => job.ref.id === selected?.ref.id)
  const { start, end } = visibleWindow(jobs.length, cursor, height - 2)
  // Marker, dot, the space after it and the time column.
  const name = width - 4 - 3 - TIME

  return (
    <Panel
      title="Jobs"
      footer={jobs.length === 0 ? undefined : plural(jobs.length, "job")}
      focused
      width={width}
      height={height}
    >
      {jobs.slice(start, end).map(job => {
        const isSelected = job.ref.id === selected?.ref.id

        const label =
          job.stage === undefined ? job.name : `${job.stage} › ${job.name}`

        return (
          <text
            key={job.ref.id}
            wrapMode="none"
            bg={isSelected ? theme.selection : undefined}
          >
            <span fg={theme.accent}>{isSelected ? "▌" : " "}</span>
            <StatusDot status={job.status} />
            <span fg={theme.text}>{` ${fit(label, name)}`}</span>
            <span fg={theme.muted}>
              {formatDuration(elapsed(job, now)).padStart(TIME)}
            </span>
          </text>
        )
      })}
    </Panel>
  )
}
