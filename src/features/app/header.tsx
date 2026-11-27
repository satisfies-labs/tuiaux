import { useTerminalDimensions } from "@opentui/react"

import type { MonitorState } from "../../monitor"
import {
  StatusDot,
  type Tab,
  Tabs,
  formatAge,
  useText,
  useTheme,
} from "../../ui"

interface Host {
  readonly label: string
  readonly failing: boolean
}

/** One entry per host the repos live on, failing when a host-wide issue blocks it. */
const hostsOf = (state: MonitorState): ReadonlyArray<Host> => {
  const seen = new Map<string, Host>()

  for (const { repo } of state.repos)
    seen.set(`${repo.kind}:${repo.host}`, {
      label: repo.kind,
      failing: state.hostIssues.some(
        issue => issue.kind === repo.kind && issue.host === repo.host,
      ),
    })

  return [...seen.values()]
}

const lastFetch = (state: MonitorState): Date | undefined =>
  state.repos.reduce<Date | undefined>(
    (latest, entry) =>
      entry.fetchedAt !== undefined &&
      (latest === undefined || entry.fetchedAt > latest)
        ? entry.fetchedAt
        : latest,
    undefined,
  )

/** Brand, view tabs, and on the right the hosts' health and the age of the last fetch. */
export const Header = ({
  tabs,
  state,
  now,
}: {
  readonly tabs: ReadonlyArray<Tab>
  readonly state: MonitorState
  readonly now: Date
}) => {
  const theme = useTheme()
  const text = useText()
  const { width } = useTerminalDimensions()
  const hosts = hostsOf(state)
  const refreshed = `↻ ${formatAge(lastFetch(state), now)}`

  const left = text.width(
    `● tuiaux   ${tabs.map(tab => `${tab.key} ${tab.label}`).join("   ")}`,
  )

  const right = text.width(
    `${hosts.map(host => `${host.label} ●`).join("  ")}   ${refreshed}`,
  )

  return (
    <box
      height={1}
      flexShrink={0}
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
      backgroundColor={theme.surface}
    >
      <box flexDirection="row">
        <text wrapMode="none">
          <span fg={theme.success}>●</span>
          <strong fg={theme.text}>{" tuiaux   "}</strong>
        </text>
        <Tabs tabs={tabs} />
      </box>
      {left + right + 4 <= width && (
        <text wrapMode="none" fg={theme.muted}>
          {hosts.map(host => (
            <span key={host.label}>
              {`${host.label} `}
              <StatusDot status={host.failing ? "failure" : "success"} />
              {"  "}
            </span>
          ))}
          {` ${refreshed}`}
        </text>
      )}
    </box>
  )
}
