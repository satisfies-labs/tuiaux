import { isActive } from "../../domain"
import { type RepoEntry, RepoHealth } from "../../monitor"
import {
  Panel,
  StatusDot,
  describeError,
  fit,
  formatAge,
  formatDuration,
  plural,
  useTheme,
  visibleWindow,
} from "../../ui"
import { type ProviderGroup, runTime } from "./model"

type Row =
  | { readonly kind: "header"; readonly label: string }
  | { readonly kind: "repo"; readonly entry: RepoEntry }

const BRANCH = 9
const TIME = 5

const RepoRow = ({
  entry,
  selected,
  focused,
  width,
  now,
}: {
  readonly entry: RepoEntry
  readonly selected: boolean
  readonly focused: boolean
  readonly width: number
  readonly now: Date
}) => {
  const theme = useTheme()
  const latest = entry.runs[0]

  const failing = RepoHealth.$is("Failing")(entry.health)
    ? entry.health
    : undefined

  const time =
    latest !== undefined && isActive(latest.status)
      ? formatDuration(runTime(latest, now))
      : formatAge(latest?.createdAt, now)

  // Marker, dot and three separating spaces around path, branch and time.
  const path = width - BRANCH - TIME - 5

  return (
    <text wrapMode="none" bg={selected ? theme.selection : undefined}>
      <span fg={theme.accent}>{selected && focused ? "▌" : " "}</span>
      <StatusDot status={latest?.status ?? "idle"} />
      <span
        fg={entry.stale ? theme.muted : theme.text}
      >{` ${fit(entry.repo.path, path)} `}</span>
      {failing === undefined ? (
        <>
          <span fg={theme.muted}>{fit(latest?.branch ?? "", BRANCH)}</span>
          <span fg={theme.muted}>{` ${time.padStart(TIME)}`}</span>
        </>
      ) : (
        <span fg={theme.failure}>
          {fit(describeError(failing.error), BRANCH + TIME + 1)}
        </span>
      )}
    </text>
  )
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

  const rows: ReadonlyArray<Row> = groups.flatMap(group => [
    { kind: "header", label: group.kind.toUpperCase() },
    ...group.repos.map((entry): Row => ({ kind: "repo", entry })),
  ])

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
          <RepoRow
            key={row.entry.repo.key}
            entry={row.entry}
            selected={row.entry.repo.key === selected?.repo.key}
            focused={focused}
            width={width - 4}
            now={now}
          />
        ),
      )}
    </Panel>
  )
}
