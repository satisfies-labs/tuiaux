import { useEffect } from "react"

import { useAtom, useAtomSet } from "@effect/atom-react"
import { useTerminalDimensions } from "@opentui/react"

import { type Run, type RunRef, elapsed, isActive } from "../../domain"
import type { MonitorState } from "../../monitor"
import {
  type Command,
  EmptyState,
  Screen,
  StatusDot,
  View,
  flashAtom,
  formatAge,
  formatDuration,
  moveBy,
  useApp,
  useNavigation,
  useNow,
  useTheme,
} from "../../ui"
import { JobList } from "./job-list"
import { defaultJob, findRun, jobSelectionAtom, jobsOf } from "./model"
import { StepsPanel } from "./steps-panel"

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
      <box flexGrow={1} flexShrink={1} overflow="hidden" marginRight={1}>
        <text wrapMode="none" fg={theme.muted}>
          {`${run.ref.repo.path} › `}
          <span fg={theme.text}>{`${run.workflow} #${run.number}`}</span>
          {jobName === undefined ? "" : ` › ${jobName}`}
        </text>
      </box>
      <text wrapMode="none" flexShrink={0} fg={theme.muted}>
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
}: {
  readonly state: MonitorState
  readonly target: RunRef
}) => {
  const app = useApp()
  const now = useNow()
  const { width, height } = useTerminalDimensions()
  const { go, back } = useNavigation()
  const setFlash = useAtomSet(flashAtom)
  const [selectedJob, setSelectedJob] = useAtom(jobSelectionAtom)

  const run = findRun(state, target)
  const focused = jobsOf(state, target)
  const jobs = focused?.jobs ?? []
  const job = jobs.find(each => each.ref.id === selectedJob) ?? defaultJob(jobs)

  useEffect(() => app.run(monitor => monitor.focusRun(target)), [app, target])

  const select = (delta: number) =>
    setSelectedJob(
      moveBy(
        jobs.map(each => each.ref.id),
        job?.ref.id,
        delta,
      ),
    )

  const url = job?.url ?? run?.url

  const commands: ReadonlyArray<Command> = [
    {
      id: "detail.down",
      title: "Next job",
      group: "Actions",
      keys: ["j", "down"],
      hint: "job",
      hintKey: "↑↓",
      palette: false,
      run: () => select(1),
    },
    {
      id: "detail.up",
      title: "Previous job",
      group: "Actions",
      keys: ["k", "up"],
      palette: false,
      run: () => select(-1),
    },
    {
      id: "detail.back",
      title: "Back",
      group: "Actions",
      keys: ["escape", "backspace"],
      hint: "back",
      run: () => back(),
    },
    {
      id: "run.watch",
      title: "Watch run",
      group: "Actions",
      keys: ["w"],
      hint: "watch",
      run: () => go(View.Watch({ run: target })),
    },
    ...(url === undefined
      ? []
      : [
          {
            id: "detail.open",
            title:
              job?.url === undefined
                ? "Open run in browser"
                : "Open job in browser",
            group: "Actions",
            keys: ["o"],
            hint: "open",
            run: () => {
              app.open(url)
              setFlash("opened in browser")
            },
          } satisfies Command,
        ]),
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

  // Header, breadcrumb and status lines take one row each.
  const content = height - 3

  return (
    <Screen commands={commands}>
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
    </Screen>
  )
}
