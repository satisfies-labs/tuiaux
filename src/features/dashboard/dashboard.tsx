import { useEffect } from "react"

import { useAtom, useAtomSet } from "@effect/atom-react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"

import type { RepoRef } from "../../domain"
import type { MonitorState, RepoEntry } from "../../monitor"
import {
  Dialog,
  type Hint,
  KeyHints,
  StatusDot,
  View,
  moveBy,
  plural,
  useApp,
  useNow,
  useTheme,
  viewAtom,
} from "../../ui"
import { JobsPanel } from "./jobs-panel"
import { forgetAtom, groupByProvider, selectionAtom, tally } from "./model"
import { RepoList } from "./repo-list"
import { RunsTable } from "./runs-table"

/** The repos panel takes about a third of the width, within readable bounds. */
const reposWidth = (width: number) =>
  Math.min(44, Math.max(32, Math.floor(width * 0.36)))

export const DASHBOARD_HINTS: ReadonlyArray<Hint> = [
  ["↑↓", "move"],
  ["tab", "panel"],
  ["⏎", "details"],
  ["w", "watch"],
  ["o", "open"],
  ["d", "forget"],
  ["r", "refresh"],
  ["?", "help"],
  ["q", "quit"],
]

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

const ForgetDialog = ({ repo }: { readonly repo: RepoRef }) => {
  const theme = useTheme()

  return (
    <Dialog title="forget repo">
      <text fg={theme.text}>{`Forget ${repo.path}?`}</text>
      <text fg={theme.muted}>
        It leaves the list until it shows runs again from its own directory.
      </text>
      <box marginTop={1}>
        <KeyHints
          hints={[
            ["y", "forget"],
            ["n", "keep"],
          ]}
        />
      </box>
    </Dialog>
  )
}

/** Repos on the left, runs and jobs of the selection on the right. `active`: keys are ours. */
export const Dashboard = ({
  state,
  active,
}: {
  readonly state: MonitorState
  readonly active: boolean
}) => {
  const app = useApp()
  const theme = useTheme()
  const now = useNow()
  const { width, height } = useTerminalDimensions()
  const [selection, setSelection] = useAtom(selectionAtom)
  const [forgetting, setForgetting] = useAtom(forgetAtom)
  const setView = useAtomSet(viewAtom)

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

  useKeyboard(key => {
    if (!active) return

    if (forgetting !== undefined) {
      if (key.name === "y") app.run(monitor => monitor.forget(forgetting))

      if (["y", "n", "escape"].includes(key.name)) setForgetting(undefined)

      return
    }

    switch (key.name) {
      case "j":
      case "down":
        return move(1)
      case "k":
      case "up":
        return move(-1)
      case "tab":
        return setSelection({
          ...selection,
          panel: runsFocused ? "repos" : "runs",
        })
      case "l":
      case "right":
        return setSelection({ ...selection, panel: "runs" })
      case "h":
      case "left":
        return setSelection({ ...selection, panel: "repos" })
      case "return":
        if (run !== undefined) setView(View.RunDetail({ run: run.ref }))

        return
      case "w":
        if (run !== undefined) setView(View.Watch({ run: run.ref }))

        return
      case "o":
        if (runsFocused && run !== undefined) app.open(run.url)
        else if (entry !== undefined) app.open(repoUrl(entry.repo))

        return
      case "d":
        if (!runsFocused && entry !== undefined && !entry.current)
          setForgetting(entry.repo)
    }
  })

  if (state.repos.length === 0)
    return (
      <box paddingX={1} paddingY={1}>
        <text fg={theme.muted}>
          {state.inGitRepo
            ? "This repo's remote isn't on github.com or gitlab.com."
            : "You are currently not in a Git repo, and no repo is remembered yet."}
        </text>
      </box>
    )

  // Header, summary and status lines take one row each.
  const content = height - 3
  const runsHeight = Math.ceil(content / 2)
  const repoWidth = reposWidth(width)
  const rightWidth = width - repoWidth

  return (
    <box flexDirection="column" flexGrow={1}>
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
      {forgetting !== undefined && <ForgetDialog repo={forgetting} />}
    </box>
  )
}
