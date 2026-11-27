import { useTheme } from "../theme"
import { StatusDot } from "./status-dot"

/** What an empty screen or panel says: a calm dot, a title, and what to do about it. */
export const EmptyState = ({
  title,
  lines = [],
}: {
  readonly title: string
  readonly lines?: ReadonlyArray<string> | undefined
}) => {
  const theme = useTheme()

  return (
    <box flexDirection="column" paddingX={1} paddingY={1}>
      <text wrapMode="none">
        <StatusDot status="idle" />
        <span fg={theme.text}>{` ${title}`}</span>
      </text>
      {lines.map(line => (
        <text key={line} fg={theme.muted}>
          {`  ${line}`}
        </text>
      ))}
    </box>
  )
}
