import { elapsed, isActive } from "../../domain"
import { type RepoEntry, RepoHealth } from "../../monitor"
import {
  type Column,
  Panel,
  StatusDot,
  Table,
  describeError,
  formatAge,
  formatDuration,
  panelInner,
  plural,
  useTheme,
  visibleWindow,
} from "../../ui"
import type { ProviderGroup } from "./model"

type Row =
  | { readonly kind: "header"; readonly label: string }
  | {
      readonly kind: "repo"
      readonly entry: RepoEntry
      readonly name: (entry: RepoEntry) => string
    }

const failingOf = (entry: RepoEntry) =>
  RepoHealth.$is("Failing")(entry.health) ? entry.health : undefined

const columns = (
  now: Date,
  name: (entry: RepoEntry) => string,
): ReadonlyArray<Column<RepoEntry>> => [
  {
    id: "name",
    width: 0,
    flex: true,
    min: 12,
    priority: 10,
    value: name,
    tone: entry => (entry.stale ? "muted" : "text"),
  },
  {
    id: "branch",
    width: 9,
    priority: 4,
    value: entry => entry.runs[0]?.branch ?? "",
    tone: () => "muted",
  },
  {
    id: "time",
    width: 8,
    align: "right",
    priority: 8,
    value: entry => {
      const latest = entry.runs[0]

      return latest !== undefined && isActive(latest.status)
        ? formatDuration(elapsed(latest, now))
        : formatAge(latest?.createdAt, now)
    },
    tone: () => "muted",
  },
]

/** A repo whose fetch fails shows why instead of its branch and time. */
const failingColumns = (
  name: (entry: RepoEntry) => string,
): ReadonlyArray<Column<RepoEntry>> => [
  {
    id: "name",
    width: 0,
    flex: true,
    min: 6,
    priority: 10,
    value: name,
    tone: () => "muted",
  },
  {
    id: "error",
    width: 15,
    priority: 8,
    value: entry => {
      const failing = failingOf(entry)

      return failing === undefined ? "" : describeError(failing.error)
    },
    tone: () => "failure",
  },
]

/** The repo name alone when the whole group shares one owner, else the full path. */
const namer = (group: ProviderGroup) => {
  const owners = new Set(group.repos.map(e => e.repo.path.split("/")[0]))

  return (entry: RepoEntry) =>
    owners.size === 1
      ? (entry.repo.path.split("/").at(-1) ?? entry.repo.path)
      : entry.repo.path
}

/** The repos, grouped by provider, scrolled to keep the selected one visible. */
export const RepoList = ({
  groups,
  selected,
  focused,
  width,
  height,
  now,
}: {
  readonly groups: ReadonlyArray<ProviderGroup>
  readonly selected: RepoEntry | undefined
  readonly focused: boolean
  readonly width: number
  readonly height: number
  readonly now: Date
}) => {
  const theme = useTheme()

  const rows: ReadonlyArray<Row> = groups.flatMap(group => {
    const name = namer(group)

    return [
      {
        kind: "header",
        label: `${group.kind.toUpperCase()} · ${group.repos.length}`,
      },
      ...group.repos.map((entry): Row => ({ kind: "repo", entry, name })),
    ]
  })

  const cursor = rows.findIndex(
    row => row.kind === "repo" && row.entry.repo.key === selected?.repo.key,
  )

  const inner = height - 2
  const { start, end } = visibleWindow(rows.length, cursor, inner)
  const count = groups.reduce((sum, group) => sum + group.repos.length, 0)

  return (
    <Panel
      title="Repos"
      footer={plural(count, "repo")}
      focused={focused}
      width={width}
      height={height}
    >
      {rows.slice(start, end).map(row =>
        row.kind === "header" ? (
          <text key={row.label} wrapMode="none" fg={theme.muted}>
            <strong>{row.label}</strong>
          </text>
        ) : (
          <Table
            key={row.entry.repo.key}
            columns={
              failingOf(row.entry) === undefined
                ? columns(now, row.name)
                : failingColumns(row.name)
            }
            rows={[row.entry]}
            rowKey={entry => entry.repo.key}
            lead={entry =>
              failingOf(entry) === undefined ? (
                <StatusDot status={entry.runs[0]?.status ?? "idle"} now={now} />
              ) : (
                <span fg={theme.failure}>!</span>
              )
            }
            selected={selected?.repo.key}
            focused={focused}
            width={panelInner(width)}
            height={1}
          />
        ),
      )}
    </Panel>
  )
}
