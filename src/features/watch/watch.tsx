import { Equal, Option } from "effect"
import { useEffect } from "react"

import { useAtomSet } from "@effect/atom-react"
import { useTerminalDimensions } from "@opentui/react"

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
  type Command,
  EmptyState,
  Panel,
  ProgressBar,
  Screen,
  StatusDot,
  flashAtom,
  formatDuration,
  useApp,
  useNavigation,
  useNow,
  useText,
  useTheme,
} from "../../ui"

/** Average completion of the jobs; before any job shows up, 0 while active and 1 once settled. */
const overall = (jobs: ReadonlyArray<Job>, run: Run): number => {
  if (jobs.length === 0) return isActive(run.status) ? 0 : 1

  return jobs.reduce((sum, job) => sum + completion(job), 0) / jobs.length
}

/** One run, small enough for a tmux pane: status, overall progress, a dot per job. */
export const Watch = ({
  state,
  target,
}: {
  readonly state: MonitorState
  readonly target: RunRef
}) => {
  const app = useApp()
  const theme = useTheme()
  const now = useNow()
  const { width } = useTerminalDimensions()
  const text = useText()
  const { back } = useNavigation()
  const setFlash = useAtomSet(flashAtom)

  const run = state
    .entry(target.repo)
    ?.runs.find(each => Equal.equals(each.ref, target))

  const jobs =
    state.focusedRun !== undefined && Equal.equals(state.focusedRun.run, target)
      ? state.focusedRun.jobs
      : []

  useEffect(() => app.run(monitor => monitor.focusRun(target)), [app, target])

  const commands: ReadonlyArray<Command> = [
    ...(run === undefined
      ? []
      : [
          {
            id: "watch.open",
            title: "Open run in browser",
            group: "Actions",
            keys: ["o"],
            hint: "open",
            run: () => {
              app.open(run.url)
              setFlash("opened in browser")
            },
          } satisfies Command,
        ]),
    {
      id: "watch.back",
      title: "Back",
      group: "Actions",
      keys: ["escape", "backspace"],
      hint: "back",
      run: () => back(),
    },
  ]

  if (run === undefined)
    return (
      <Screen commands={commands}>
        <EmptyState
          title="This run isn't in the recent list anymore."
          lines={["esc goes back."]}
        />
      </Screen>
    )

  const progress = overall(jobs, run)
  const percent = `${Math.round(progress * 100)}%`.padStart(5)
  const card = Math.min(64, width - 2)
  // Panel borders and padding, then the percentage.
  const bar = Math.max(10, card - 4 - percent.length - 1)
  const name = run.ref.repo.path.split("/").at(-1) ?? run.ref.repo.path

  const label = (job: Job, timed: boolean) => {
    const time = elapsed(job, now)

    return timed && Option.isSome(time)
      ? `${job.name} ${formatDuration(time)}`
      : job.name
  }

  // Durations after each job when the whole line still fits on the card.
  const timed =
    text.width(jobs.map(job => `● ${label(job, true)}  `).join("")) <= card - 4

  return (
    <Screen commands={commands}>
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <Panel title="watch" width={card}>
          <box flexDirection="row" justifyContent="space-between">
            <text wrapMode="none">
              <StatusDot status={run.status} now={now} />
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
                    <StatusDot status={job.status} now={now} />
                    {` ${label(job, timed)}  `}
                  </span>
                ))}
          </text>
        </Panel>
      </box>
    </Screen>
  )
}
