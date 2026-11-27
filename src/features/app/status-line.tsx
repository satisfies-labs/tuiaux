import type { HostIssue } from "../../monitor"
import { type Hint, KeyHints, describeError, useTheme } from "../../ui"

const HINTS: ReadonlyArray<Hint> = [
  ["r", "refresh"],
  ["q", "quit"],
]

/** Host-wide problems take the line; otherwise the global keys. */
export const StatusLine = ({
  issues,
}: {
  readonly issues: ReadonlyArray<HostIssue>
}) => {
  const theme = useTheme()

  return (
    <box height={1} paddingX={1} backgroundColor={theme.surface}>
      {issues.length === 0 ? (
        <KeyHints hints={HINTS} />
      ) : (
        <text wrapMode="none" fg={theme.failure}>
          {issues.map(describeError).join("  ·  ")}
        </text>
      )}
    </box>
  )
}
