import { Option } from "effect"

import { type ProviderKind, type Run, elapsed } from "../../domain"
import type { RepoEntry } from "../../monitor"
import {
  Panel,
  StatusDot,
  formatAge,
  formatDuration,
  plural,
  useText,
  useTheme,
  visibleWindow,
} from "../../ui"
import { runStats } from "./model"

const WORKFLOW = 10
const NUMBER = 5
const BRANCH = 10
const EVENT = 8

/** Fits `h:mm:ss`. */
const TIME = 8
const AGE = 4

/** Marker, dot, and one space after each column but the last. */
const FIXED = 2 + WORKFLOW + NUMBER + BRANCH + TIME + AGE + 6

/** Narrower than this, the commit column keeps the room and EVENT goes. */
const MIN_COMMIT = 16

/** Why a repo can show no runs: usually there's no CI configuration on the provider's side. */
const noRuns: Record<ProviderKind, string> = {
  github:
    "No workflow runs yet. GitHub Actions runs the workflows in .github/workflows/.",
  gitlab:
    "No pipelines yet. GitLab CI runs the pipeline defined in .gitlab-ci.yml.",
}

const RunRow = ({
  run,
  selected,
  focused,
  commit,
  event,
  now,
}: {
  readonly run: Run
  readonly selected: boolean
  readonly focused: boolean
  readonly commit: number
  readonly event: boolean
  readonly now: Date
}) => {
  const theme = useTheme()
  const { fit } = useText()

  return (
    <text wrapMode="none" bg={selected ? theme.selection : undefined}>
      <span fg={theme.accent}>{selected && focused ? "▌" : " "}</span>
      <StatusDot status={run.status} />
      <span fg={theme.text}>{` ${fit(run.workflow, WORKFLOW)} `}</span>
      <span fg={theme.muted}>{fit(String(run.number), NUMBER)} </span>
      <span fg={theme.text}>{fit(run.branch, BRANCH)} </span>
      <span fg={theme.text}>{fit(run.commitMessage ?? "—", commit)} </span>
      {event && <span fg={theme.muted}>{fit(run.event, EVENT)} </span>}
      <span fg={theme.muted}>
        {fit(formatDuration(elapsed(run, now)), TIME)}{" "}
      </span>
      <span fg={theme.muted}>{fit(formatAge(run.createdAt, now), AGE)}</span>
    </text>
  )
}

/** The runs of the selected repo, newest first, with their average duration and success rate. */
export const RunsTable = ({
  entry,
  selected,
  focused,
  width,
  height,
  now,
}: {
  readonly entry: RepoEntry | undefined
  readonly selected: Run | undefined
  readonly focused: boolean
  readonly width: number
  readonly height: number
  readonly now: Date
}) => {
  const theme = useTheme()
  const { fit } = useText()
  const runs = entry?.runs ?? []
  const room = width - 4 - FIXED
  const event = room - EVENT - 1 >= MIN_COMMIT
  const commit = Math.max(8, event ? room - EVENT - 1 : room)
  const { average, okRatio } = runStats(runs)
  const cursor = runs.findIndex(run => run.ref.id === selected?.ref.id)
  // Borders and the column header.
  const { start, end } = visibleWindow(runs.length, cursor, height - 3)

  const footer = [
    plural(runs.length, "run"),
    `avg ${formatDuration(average)}`,
    ...Option.toArray(
      Option.map(okRatio, ratio => `ok ${Math.round(ratio * 100)}%`),
    ),
  ].join(" · ")

  return (
    <Panel
      title={entry === undefined ? "Runs" : `Runs · ${entry.repo.path}`}
      footer={runs.length === 0 ? undefined : footer}
      focused={focused}
      height={height}
    >
      <text wrapMode="none" fg={theme.muted}>
        {`   ${fit("WORKFLOW", WORKFLOW)} ${fit("#", NUMBER)} ${fit("BRANCH", BRANCH)} ${fit("COMMIT", commit)} ${event ? `${fit("EVENT", EVENT)} ` : ""}${fit("TIME", TIME)} AGE`}
      </text>
      {runs.length === 0 ? (
        <text fg={theme.muted}>
          {entry === undefined ? "No runs yet." : noRuns[entry.repo.kind]}
        </text>
      ) : (
        runs
          .slice(start, end)
          .map(run => (
            <RunRow
              key={run.ref.id}
              run={run}
              selected={run.ref.id === selected?.ref.id}
              focused={focused}
              commit={commit}
              event={event}
              now={now}
            />
          ))
      )}
    </Panel>
  )
}
