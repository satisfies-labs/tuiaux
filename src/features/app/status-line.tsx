import type { HostIssue } from "../../monitor"
import { type Hint, KeyHints, describeError, useTheme } from "../../ui"

/** Host-wide problems take the line; otherwise the keys of the current view. */
export const StatusLine = ({
  issues,
  hints,
}: {
  readonly issues: ReadonlyArray<HostIssue>
  readonly hints: ReadonlyArray<Hint>
}) => {
  const theme = useTheme()

  return (
    <box height={1} flexShrink={0} paddingX={1} backgroundColor={theme.surface}>
      {issues.length === 0 ? (
        <KeyHints hints={hints} />
      ) : (
        <text wrapMode="none" fg={theme.failure}>
          {issues.map(describeError).join("  ·  ")}
        </text>
      )}
    </box>
  )
}
