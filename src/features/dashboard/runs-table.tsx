import { Option } from "effect"

import { type ProviderKind, type Run, elapsed } from "../../domain"
import type { RepoEntry } from "../../monitor"
import {
  type Column,
  Panel,
  StatusDot,
  Table,
  formatAge,
  formatDuration,
  panelInner,
  plural,
  useTheme,
} from "../../ui"
import { runStats } from "./model"

const columns = (now: Date): ReadonlyArray<Column<Run>> => [
  {
    id: "workflow",
    header: "WORKFLOW",
    width: 10,
    priority: 9,
    value: run => run.workflow,
  },
  {
    id: "number",
    header: "#",
    width: 5,
    priority: 6,
    value: run => String(run.number),
    tone: () => "muted",
  },
  {
    id: "commit",
    header: "COMMIT",
    width: 0,
    flex: true,
    min: 12,
    priority: 10,
    value: run => run.commitMessage ?? "—",
  },
  {
    id: "branch",
    header: "BRANCH",
    width: 10,
    priority: 4,
    value: run => run.branch,
  },
  {
    id: "event",
    header: "EVENT",
    width: 8,
    priority: 2,
    value: run => run.event,
    tone: () => "muted",
  },
  {
    id: "time",
    header: "TIME",
    width: 8,
    align: "right",
    priority: 8,
    value: run => formatDuration(elapsed(run, now)),
    tone: () => "muted",
  },
  {
    id: "age",
    header: "AGE",
    width: 4,
    align: "right",
    priority: 7,
    value: run => formatAge(run.createdAt, now),
    tone: () => "muted",
  },
]

/** Why a repo can show no runs: usually there's no CI configuration on the provider's side. */
const noRuns: Record<ProviderKind, string> = {
  github:
    "No workflow runs yet. GitHub Actions runs the workflows in .github/workflows/.",
  gitlab:
    "No pipelines yet. GitLab CI runs the pipeline defined in .gitlab-ci.yml.",
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
  const runs = entry?.runs ?? []
  const { average, okRatio } = runStats(runs)

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
      width={width}
      height={height}
    >
      {runs.length === 0 ? (
        <text fg={theme.muted}>
          {entry === undefined ? "No runs yet." : noRuns[entry.repo.kind]}
        </text>
      ) : (
        <Table
          header
          columns={columns(now)}
          rows={runs}
          rowKey={run => run.ref.id}
          lead={run => <StatusDot status={run.status} now={now} />}
          selected={selected?.ref.id}
          focused={focused}
          width={panelInner(width)}
          height={height - 2}
        />
      )}
    </Panel>
  )
}
