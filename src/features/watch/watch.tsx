import { Equal } from "effect"
import { useEffect } from "react"

import { useAtomSet } from "@effect/atom-react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"

import {
  type Job,
  type Run,
  type RunRef,
  completion,
  elapsed,
  isActive,
} from "../../domain"
import type { MonitorState } from "../../monitor"
import {
  type Hint,
  Panel,
  ProgressBar,
  StatusDot,
  View,
  formatDuration,
  useApp,
  useNow,
  useTheme,
  viewAtom,
} from "../../ui"

export const WATCH_HINTS: ReadonlyArray<Hint> = [
  ["o", "open"],
  ["esc", "back"],
  ["q", "quit"],
]

/** Average completion of the jobs; before any job shows up, 0 while active and 1 once settled. */
const overall = (jobs: ReadonlyArray<Job>, run: Run): number => {
  if (jobs.length === 0) return isActive(run.status) ? 0 : 1

  return jobs.reduce((sum, job) => sum + completion(job), 0) / jobs.length
}

/** One run, small enough for a tmux pane: status, overall progress, a dot per job. */
export const Watch = ({
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
  const { width } = useTerminalDimensions()
  const setView = useAtomSet(viewAtom)

  const run = state
    .entry(target.repo)
    ?.runs.find(each => Equal.equals(each.ref, target))

  const jobs =
    state.focusedRun !== undefined && Equal.equals(state.focusedRun.run, target)
      ? state.focusedRun.jobs
      : []

  useEffect(() => app.run(monitor => monitor.focusRun(target)), [app, target])

  useKeyboard(key => {
    if (!active) return

    if (key.name === "escape" || key.name === "backspace")
      setView(View.Dashboard())
    else if (key.name === "o" && run !== undefined) app.open(run.url)
  })

  if (run === undefined)
    return (
      <box flexGrow={1} paddingX={1} paddingY={1}>
        <text fg={theme.muted}>
          This run isn't in the recent list anymore. Press esc to go back.
        </text>
      </box>
    )

  const progress = overall(jobs, run)
  const percent = `${Math.round(progress * 100)}%`.padStart(5)
  // Window padding, panel borders and padding, and the percentage.
  const bar = Math.max(10, width - 2 - 4 - percent.length - 1)
  const name = run.ref.repo.path.split("/").at(-1) ?? run.ref.repo.path

  return (
    <box flexGrow={1} paddingX={1} paddingY={1}>
      <Panel title="watch">
        <box flexDirection="row" justifyContent="space-between">
          <text wrapMode="none">
            <StatusDot status={run.status} />
            <span
              fg={theme.text}
            >{` ${name} · ${run.workflow} #${run.number} · ${run.branch}`}</span>
          </text>
          <text wrapMode="none" fg={theme.muted}>
            {formatDuration(elapsed(run, now))}
          </text>
        </box>
        <text wrapMode="none">
          <ProgressBar value={progress} width={bar} status={run.status} />
          <span fg={theme.muted}>{` ${percent}`}</span>
        </text>
        <text wrapMode="none" fg={theme.muted}>
          {jobs.length === 0
            ? "Loading jobs…"
            : jobs.map(job => (
                <span key={job.ref.id}>
                  <StatusDot status={job.status} />
                  {` ${job.name}  `}
                </span>
              ))}
        </text>
      </Panel>
    </box>
  )
}
