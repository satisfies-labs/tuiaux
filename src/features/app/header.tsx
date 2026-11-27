import { useTheme } from "../../ui"

export const Header = ({ version }: { readonly version: string }) => {
  const theme = useTheme()

  return (
    <box height={1} paddingX={1} backgroundColor={theme.surface}>
      <text wrapMode="none">
        <span fg={theme.success}>●</span>
        <strong fg={theme.text}> tuiaux</strong>
        <span fg={theme.muted}> v{version}</span>
      </text>
    </box>
  )
}
