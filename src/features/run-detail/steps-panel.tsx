import { type Job, type ProviderError, type Step, elapsed } from "../../domain"
import {
  type Column,
  Panel,
  StatusDot,
  Table,
  describeError,
  formatDuration,
  panelInner,
  plural,
  useTheme,
} from "../../ui"

const columns = (now: Date): ReadonlyArray<Column<Step>> => [
  { id: "name", width: 0, flex: true, priority: 10, value: step => step.name },
  {
    id: "time",
    width: 8,
    align: "right",
    priority: 8,
    value: step => formatDuration(elapsed(step, now)),
    tone: () => "muted",
  },
]

const Steps = ({
  job,
  loading,
  width,
  height,
  now,
}: {
  readonly job: Job | undefined
  readonly loading: boolean
  readonly width: number
  readonly height: number
  readonly now: Date
}) => {
  const theme = useTheme()

  if (job === undefined)
    return (
      <text fg={theme.muted}>
        {loading ? "Loading jobs…" : "This run has no jobs."}
      </text>
    )

  if (job.steps.length === 0)
    return (
      <text fg={theme.muted}>
        {job.stage === undefined
          ? "No steps reported for this job."
          : `Stage ${job.stage}. GitLab jobs have no steps.`}
      </text>
    )

  return (
    <Table
      columns={columns(now)}
      rows={job.steps}
      rowKey={step => `${job.steps.indexOf(step)}-${step.name}`}
      lead={step => <StatusDot status={step.status} now={now} />}
      focused={false}
      width={width}
      height={height}
    />
  )
}

/** The steps of the selected job. Logs come later; until then `o` opens the job page. */
export const StepsPanel = ({
  job,
  loading,
  error,
  width,
  height,
  now,
}: {
  readonly job: Job | undefined
  readonly loading: boolean
  readonly error: ProviderError | undefined
  readonly width: number
  readonly height: number
  readonly now: Date
}) => {
  const theme = useTheme()

  const failing =
    job?.steps.filter(step => step.status === "failure").length ?? 0

  return (
    <Panel
      title={job === undefined ? "Steps" : `Steps · ${job.name}`}
      footer={failing === 0 ? undefined : plural(failing, "failing step")}
      width={width}
      height={height}
    >
      {error !== undefined && (
        <text wrapMode="none" fg={theme.failure}>
          {describeError(error)}
        </text>
      )}
      <Steps
        job={job}
        loading={loading}
        width={panelInner(width)}
        // Borders, the error line and the hint below.
        height={Math.max(0, height - 5)}
        now={now}
      />
      {job?.url !== undefined && (
        <box marginTop={1}>
          <text fg={theme.muted}>
            o opens the job and its log in the browser.
          </text>
        </box>
      )}
    </Panel>
  )
}
