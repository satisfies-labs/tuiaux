import { type Job, type ProviderError, elapsed } from "../../domain"
import {
  Panel,
  StatusDot,
  describeError,
  fit,
  formatDuration,
  plural,
  useTheme,
} from "../../ui"

const TIME = 8

const Steps = ({
  job,
  loading,
  name,
  now,
}: {
  readonly job: Job | undefined
  readonly loading: boolean
  readonly name: number
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

  return job.steps.map((step, index) => (
    <text key={`${index}-${step.name}`} wrapMode="none">
      <StatusDot status={step.status} />
      <span fg={theme.text}>{` ${fit(step.name, name)}`}</span>
      <span fg={theme.muted}>
        {formatDuration(elapsed(step, now)).padStart(TIME)}
      </span>
    </text>
  ))
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
  // Borders, padding, dot, the space after it and the time column.
  const name = width - 4 - 2 - TIME

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
      <Steps job={job} loading={loading} name={name} now={now} />
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
