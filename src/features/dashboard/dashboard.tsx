import { useEffect } from "react"

import { useAtom, useAtomSet } from "@effect/atom-react"
import { useTerminalDimensions } from "@opentui/react"

import type { RepoRef, Tone } from "../../domain"
import type { MonitorState, RepoEntry } from "../../monitor"
import {
  type Command,
  EmptyState,
  Overlay,
  Screen,
  StatusDot,
  View,
  flashAtom,
  moveBy,
  overlayAtom,
  plural,
  useApp,
  useNavigation,
  useNow,
  useTheme,
} from "../../ui"
import { JobsPanel, jobsPanelHeight } from "./jobs-panel"
import {
  NO_FILTER,
  type RepoFilter,
  applyFilter,
  filterAtom,
  groupByProvider,
  isFiltering,
  selectionAtom,
  tally,
} from "./model"
import { RepoList } from "./repo-list"
import { RunsTable } from "./runs-table"

/** The repos panel takes about a third of the width, within readable bounds. */
const reposWidth = (width: number) =>
  Math.min(44, Math.max(32, Math.floor(width * 0.36)))

const TONES: ReadonlyArray<readonly [Tone, string]> = [
  ["failure", "failed"],
  ["running", "running"],
  ["success", "passing"],
  ["idle", "idle"],
]

const repoUrl = (repo: RepoRef) => `https://${repo.host}/${repo.path}`

const describeFilter = (filter: RepoFilter): string =>
  [
    ...(filter.query === "" ? [] : [`"${filter.query}"`]),
    ...(filter.failingOnly ? ["failing"] : []),
  ].join(" + ")

const Summary = ({
  repos,
  inGitRepo,
  filter,
}: {
  readonly repos: ReadonlyArray<RepoEntry>
  readonly inGitRepo: boolean
  readonly filter: RepoFilter
}) => {
  const theme = useTheme()
  const count = tally(repos)

  return (
    <box height={1} flexShrink={0} paddingX={1}>
      <text wrapMode="none" fg={theme.muted}>
        {plural(repos.length, "repo")}
        {TONES.flatMap(([tone, label]) =>
          count[tone] === 0
            ? []
            : [
                <span key={tone}>
                  {"  ·  "}
                  <StatusDot status={tone} />
                  {` ${count[tone]} ${label}`}
                </span>,
              ],
        )}
        {inGitRepo ? "" : "  ·  not in a Git repo"}
        {isFiltering(filter) && (
          <span
            fg={theme.accent}
          >{`  ·  filter: ${describeFilter(filter)}`}</span>
        )}
      </text>
    </box>
  )
}

/** Repos on the left, runs and jobs of the selection on the right. */
export const Dashboard = ({ state }: { readonly state: MonitorState }) => {
  const app = useApp()
  const now = useNow()
  const { width, height } = useTerminalDimensions()
  const [selection, setSelection] = useAtom(selectionAtom)
  const setOverlay = useAtomSet(overlayAtom)
  const setFlash = useAtomSet(flashAtom)
  const [filter, setFilter] = useAtom(filterAtom)
  const { go } = useNavigation()

  const groups = groupByProvider(applyFilter(state.repos, filter))
  const repos = groups.flatMap(group => group.repos)
  const entry = repos.find(e => e.repo.key === selection.repo) ?? repos[0]
  const runs = entry?.runs ?? []
  const run = runs.find(r => r.ref.id === selection.run) ?? runs[0]
  const runsFocused = selection.panel === "runs"

  // The repo under the cursor stays hot; the selected run's jobs are polled.
  useEffect(
    () => app.run(monitor => monitor.focusRepo(entry?.repo)),
    [app, entry?.repo.key],
  )
  useEffect(
    () => app.run(monitor => monitor.focusRun(run?.ref)),
    [app, run?.ref.id, entry?.repo.key],
  )

  const move = (delta: number) =>
    setSelection(
      runsFocused
        ? {
            ...selection,
            run: moveBy(
              runs.map(r => r.ref.id),
              run?.ref.id,
              delta,
            ),
          }
        : {
            ...selection,
            repo: moveBy(
              repos.map(e => e.repo.key),
              entry?.repo.key,
              delta,
            ),
            run: undefined,
          },
    )

  const commands: ReadonlyArray<Command> = [
    {
      id: "dashboard.down",
      title: "Move down",
      group: "Actions",
      keys: ["j", "down"],
      hint: "move",
      hintKey: "↑↓",
      palette: false,
      run: () => move(1),
    },
    {
      id: "dashboard.up",
      title: "Move up",
      group: "Actions",
      keys: ["k", "up"],
      palette: false,
      run: () => move(-1),
    },
    {
      id: "dashboard.panel",
      title: "Switch panel",
      group: "Actions",
      keys: ["tab"],
      hint: "panel",
      palette: false,
      run: () =>
        setSelection({ ...selection, panel: runsFocused ? "repos" : "runs" }),
    },
    {
      id: "dashboard.runs",
      title: "Focus runs",
      group: "Actions",
      keys: ["l", "right"],
      palette: false,
      run: () => setSelection({ ...selection, panel: "runs" }),
    },
    {
      id: "dashboard.repos",
      title: "Focus repos",
      group: "Actions",
      keys: ["h", "left"],
      palette: false,
      run: () => setSelection({ ...selection, panel: "repos" }),
    },
    ...(run === undefined
      ? []
      : [
          {
            id: "run.details",
            title: "Open run details",
            group: "Actions",
            keys: ["return"],
            hint: "details",
            run: () => go(View.RunDetail({ run: run.ref })),
          } satisfies Command,
          {
            id: "run.watch",
            title: "Watch run",
            group: "Actions",
            keys: ["w"],
            hint: "watch",
            run: () => go(View.Watch({ run: run.ref })),
          } satisfies Command,
        ]),
    ...(entry === undefined
      ? []
      : [
          {
            id: "dashboard.open",
            title:
              runsFocused && run !== undefined
                ? "Open run in browser"
                : "Open repo in browser",
            group: "Actions",
            keys: ["o"],
            hint: "open",
            run: () => {
              app.open(
                runsFocused && run !== undefined
                  ? run.url
                  : repoUrl(entry.repo),
              )
              setFlash("opened in browser")
            },
          } satisfies Command,
        ]),
    ...(entry === undefined || entry.current
      ? []
      : [
          {
            id: "repo.forget",
            title: "Forget repo",
            group: "Actions",
            keys: ["d"],
            hint: "forget",
            run: () =>
              setOverlay(
                Overlay.Confirm({
                  title: "forget repo",
                  message: `Forget ${entry.repo.path}? It leaves the list until it shows runs again from its own directory.`,
                  confirm: "forget",
                  run: () => {
                    app.run(monitor => monitor.forget(entry.repo))
                    setFlash(`forgot ${entry.repo.path}`)
                  },
                }),
              ),
          } satisfies Command,
        ]),
    {
      id: "dashboard.filter",
      title: "Filter repos",
      group: "Actions",
      keys: ["/"],
      hint: "filter",
      run: () =>
        setOverlay(
          Overlay.Prompt({
            title: "filter repos",
            initial: filter.query,
            submit: query => setFilter({ ...filter, query: query.trim() }),
          }),
        ),
    },
    {
      id: "dashboard.failing",
      title: filter.failingOnly ? "Show all repos" : "Show failing repos only",
      group: "Actions",
      keys: ["f"],
      run: () => setFilter({ ...filter, failingOnly: !filter.failingOnly }),
    },
    ...(isFiltering(filter)
      ? [
          {
            id: "dashboard.clear-filter",
            title: "Clear the filter",
            group: "Actions",
            keys: ["escape"],
            hint: "clear filter",
            run: () => setFilter(NO_FILTER),
          } satisfies Command,
        ]
      : []),
  ]

  if (state.repos.length === 0)
    return (
      <Screen commands={commands}>
        {state.inGitRepo ? (
          <EmptyState
            title="This repo's remote isn't on github.com or gitlab.com."
            lines={["tuiaux follows GitHub Actions and GitLab CI repos."]}
          />
        ) : (
          <EmptyState
            title="You are currently not in a Git repo, and no repo is remembered yet."
            lines={[
              "Run tuiaux inside a repo once: it is remembered from then on.",
            ]}
          />
        )}
      </Screen>
    )

  // Header, summary and status lines take one row each.
  const content = height - 3

  const runsHeight =
    content - jobsPanelHeight(state.focusedRun?.jobs.length ?? 0, content)

  const repoWidth = reposWidth(width)
  const rightWidth = width - repoWidth

  if (repos.length === 0)
    return (
      <Screen commands={commands}>
        <Summary
          repos={state.repos}
          inGitRepo={state.inGitRepo}
          filter={filter}
        />
        <EmptyState
          title={`No repo matches ${describeFilter(filter)}.`}
          lines={["esc clears the filter."]}
        />
      </Screen>
    )

  return (
    <Screen commands={commands}>
      <Summary
        repos={state.repos}
        inGitRepo={state.inGitRepo}
        filter={filter}
      />
      <box flexDirection="row" flexGrow={1}>
        <RepoList
          groups={groups}
          selected={entry}
          focused={!runsFocused}
          width={repoWidth}
          height={content}
          now={now}
        />
        <box flexDirection="column" flexGrow={1}>
          <RunsTable
            entry={entry}
            selected={run}
            focused={runsFocused}
            width={rightWidth}
            height={runsHeight}
            now={now}
          />
          <JobsPanel
            run={run}
            focused={state.focusedRun}
            width={rightWidth}
            height={content - runsHeight}
            now={now}
          />
        </box>
      </box>
    </Screen>
  )
}
