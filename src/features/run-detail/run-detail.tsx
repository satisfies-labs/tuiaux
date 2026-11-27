import { useEffect } from "react"

import { useAtom, useAtomSet } from "@effect/atom-react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"

import { type Run, type RunRef, elapsed, isActive } from "../../domain"
import type { MonitorState } from "../../monitor"
import {
  type Hint,
  StatusDot,
  View,
  formatAge,
  formatDuration,
  moveBy,
  useApp,
  useNow,
  useTheme,
  viewAtom,
} from "../../ui"
import { JobList } from "./job-list"
import { defaultJob, findRun, jobSelectionAtom, jobsOf } from "./model"
import { StepsPanel } from "./steps-panel"

export const RUN_DETAIL_HINTS: ReadonlyArray<Hint> = [
  ["↑↓", "job"],
  ["o", "open"],
  ["esc", "back"],
  ["r", "refresh"],
  ["?", "help"],
  ["q", "quit"],
]

const jobsWidth = (width: number) =>
  Math.min(48, Math.max(32, Math.floor(width * 0.38)))

/** `repo › CI #412 › test` on the left, the run's status, duration and age on the right. */
const Breadcrumb = ({
  run,
  jobName,
  now,
}: {
  readonly run: Run
  readonly jobName: string | undefined
  readonly now: Date
}) => {
  const theme = useTheme()
  const verb = isActive(run.status) ? "for" : "in"

  return (
    <box
      height={1}
      flexShrink={0}
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      <text wrapMode="none" fg={theme.muted}>
        {`${run.ref.repo.path} › `}
        <span fg={theme.text}>{`${run.workflow} #${run.number}`}</span>
        {jobName === undefined ? "" : ` › ${jobName}`}
      </text>
      <text wrapMode="none" fg={theme.muted}>
        <StatusDot status={run.status} />
        {` ${run.status} ${verb} ${formatDuration(elapsed(run, now))} · ${formatAge(run.createdAt, now)} ago`}
      </text>
    </box>
  )
}

/** One run: its jobs on the left, the selected job's steps on the right. */
export const RunDetail = ({
  state,
  target,
  active,
}: {
  readonly state: MonitorState
  readonly target: RunRef
  readonly active: boolean
}) => {
  const app = useApp()
  const theme = useTheme()
  const now = useNow()
  const { width, height } = useTerminalDimensions()
  const setView = useAtomSet(viewAtom)
  const [selectedJob, setSelectedJob] = useAtom(jobSelectionAtom)

  const run = findRun(state, target)
  const focused = jobsOf(state, target)
  const jobs = focused?.jobs ?? []
  const job = jobs.find(each => each.ref.id === selectedJob) ?? defaultJob(jobs)

  useEffect(() => app.run(monitor => monitor.focusRun(target)), [app, target])

  useKeyboard(key => {
    if (!active) return

    switch (key.name) {
      case "escape":
      case "backspace":
        return setView(View.Dashboard())
      case "j":
      case "down":
        return setSelectedJob(
          moveBy(
            jobs.map(each => each.ref.id),
            job?.ref.id,
            1,
          ),
        )
      case "k":
      case "up":
        return setSelectedJob(
          moveBy(
            jobs.map(each => each.ref.id),
            job?.ref.id,
            -1,
          ),
        )
      case "o": {
        const url = job?.url ?? run?.url

        if (url !== undefined) app.open(url)
      }
    }
  })

  if (run === undefined)
    return (
      <box flexGrow={1} paddingX={1} paddingY={1}>
        <text fg={theme.muted}>
          This run isn't in the recent list anymore. Press esc to go back.
        </text>
      </box>
    )

  // Header, breadcrumb and status lines take one row each.
  const content = height - 3

  return (
    <box flexDirection="column" flexGrow={1}>
      <Breadcrumb run={run} jobName={job?.name} now={now} />
      <box flexDirection="row" flexGrow={1}>
        <JobList
          jobs={jobs}
          selected={job}
          width={jobsWidth(width)}
          height={content}
          now={now}
        />
        <StepsPanel
          job={job}
          width={width - jobsWidth(width)}
          loading={focused === undefined}
          error={focused?.error}
          height={content}
          now={now}
        />
      </box>
    </box>
  )
}
