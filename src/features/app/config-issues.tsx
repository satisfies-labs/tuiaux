import type { ConfigIssue } from "../../platform"
import { Dialog, KeyHints, describeIssue, useTheme } from "../../ui"

/** Shown once at startup when config.toml had problems; the app runs on defaults meanwhile. */
export const ConfigIssues = ({
  path,
  issues,
}: {
  readonly path: string
  readonly issues: ReadonlyArray<ConfigIssue>
}) => {
  const theme = useTheme()

  return (
    <Dialog title="config.toml">
      <text fg={theme.muted}>{path}</text>
      {issues.map(issue => (
        <text key={describeIssue(issue)} fg={theme.text}>
          {`• ${describeIssue(issue)}`}
        </text>
      ))}
      <box marginTop={1}>
        <KeyHints hints={[["esc", "close"]]} />
      </box>
    </Dialog>
  )
}
