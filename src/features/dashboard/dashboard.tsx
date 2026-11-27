import { useEffect } from "react"

import { useAtom, useAtomSet } from "@effect/atom-react"
import { useTerminalDimensions } from "@opentui/react"

import type { RepoRef } from "../../domain"
import type { MonitorState, RepoEntry } from "../../monitor"
import {
  type Command,
  Overlay,
  Screen,
  StatusDot,
  View,
  moveBy,
  overlayAtom,
  plural,
  useApp,
  useNavigation,
  useNow,
  useTheme,
} from "../../ui"
import { JobsPanel } from "./jobs-panel"
import { groupByProvider, selectionAtom, tally } from "./model"
import { RepoList } from "./repo-list"
import { RunsTable } from "./runs-table"

/** The repos panel takes about a third of the width, within readable bounds. */
const reposWidth = (width: number) =>
  Math.min(44, Math.max(32, Math.floor(width * 0.36)))

const repoUrl = (repo: RepoRef) => `https://${repo.host}/${repo.path}`

const Summary = ({
  repos,
  inGitRepo,
}: {
  readonly repos: ReadonlyArray<RepoEntry>
  readonly inGitRepo: boolean
}) => {
  const theme = useTheme()
  const count = tally(repos)

  return (
    <box height={1} flexShrink={0} paddingX={1}>
      <text wrapMode="none" fg={theme.muted}>
        {`${plural(repos.length, "repo")}  ·  `}
        <StatusDot status="success" />
        {` ${count.success} passing   `}
        <StatusDot status="running" />
        {` ${count.running} running   `}
        <StatusDot status="failure" />
        {` ${count.failure} failed   `}
        <StatusDot status="idle" />
        {` ${count.idle} idle`}
        {inGitRepo ? "" : "  ·  not in a Git repo"}
      </text>
    </box>
  )
}

/** Repos on the left, runs and jobs of the selection on the right. `active`: keys are ours. */
export const Dashboard = ({ state }: { readonly state: MonitorState }) => {
  const app = useApp()
  const theme = useTheme()
  const now = useNow()
  const { width, height } = useTerminalDimensions()
  const [selection, setSelection] = useAtom(selectionAtom)
  const setOverlay = useAtomSet(overlayAtom)
  const { go } = useNavigation()

  const groups = groupByProvider(state.repos)
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
            run: () =>
              app.open(
                runsFocused && run !== undefined
                  ? run.url
                  : repoUrl(entry.repo),
              ),
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
                  run: () => app.run(monitor => monitor.forget(entry.repo)),
                }),
              ),
          } satisfies Command,
        ]),
  ]

  if (state.repos.length === 0)
    return (
      <Screen commands={commands}>
        <box paddingX={1} paddingY={1}>
          <text fg={theme.muted}>
            {state.inGitRepo
              ? "This repo's remote isn't on github.com or gitlab.com."
              : "You are currently not in a Git repo, and no repo is remembered yet."}
          </text>
        </box>
      </Screen>
    )

  // Header, summary and status lines take one row each.
  const content = height - 3
  const runsHeight = Math.ceil(content / 2)
  const repoWidth = reposWidth(width)
  const rightWidth = width - repoWidth

  return (
    <Screen commands={commands}>
      <Summary repos={state.repos} inGitRepo={state.inGitRepo} />
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
