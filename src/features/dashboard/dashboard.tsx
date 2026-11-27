import type { MonitorState, RepoEntry } from "../../monitor"
import { RepoHealth } from "../../monitor"
import { StatusDot, describeError, fit, useTheme } from "../../ui"

const RepoRow = ({ entry }: { readonly entry: RepoEntry }) => {
  const theme = useTheme()
  const latest = entry.runs[0]

  return (
    <text wrapMode="none">
      <StatusDot status={latest?.status ?? "idle"} />
      <span fg={theme.text}>{` ${fit(entry.repo.path, 36)} `}</span>
      <span fg={theme.muted}>{fit(latest?.branch ?? "", 20)}</span>
      {RepoHealth.$is("Failing")(entry.health) && (
        <span
          fg={theme.failure}
        >{` ${describeError(entry.health.error)}`}</span>
      )}
    </text>
  )
}

/** The repo list. Panels, cursor and runs come with the full dashboard. */
export const Dashboard = ({ state }: { readonly state: MonitorState }) => {
  const theme = useTheme()

  if (state.repos.length === 0)
    return (
      <text fg={theme.muted}>
        {state.inGitRepo
          ? "This repo's remote isn't on github.com or gitlab.com."
          : "You are currently not in a Git repo, and no repo is remembered yet."}
      </text>
    )

  return (
    <box flexDirection="column">
      {!state.inGitRepo && (
        <text fg={theme.muted}>You are currently not in a Git repo.</text>
      )}
      {state.repos.map(entry => (
        <RepoRow key={entry.repo.key} entry={entry} />
      ))}
    </box>
  )
}
