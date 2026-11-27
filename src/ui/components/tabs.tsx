import { useTheme } from "../theme"

export interface Tab {
  readonly key: string
  readonly label: string
  readonly active: boolean
  readonly enabled: boolean
}

/** `1 Dashboard   2 Run   3 Watch`: the active tab underlined in the accent color, disabled ones faded. */
export const Tabs = ({ tabs }: { readonly tabs: ReadonlyArray<Tab> }) => {
  const theme = useTheme()

  return (
    <text wrapMode="none">
      {tabs.map((tab, index) => (
        <span key={tab.key}>
          {index === 0 ? "" : "   "}
          {tab.active ? (
            <u>
              <strong fg={theme.accent}>{`${tab.key} ${tab.label}`}</strong>
            </u>
          ) : (
            <span fg={tab.enabled ? theme.muted : theme.line}>
              {`${tab.key} ${tab.label}`}
            </span>
          )}
        </span>
      ))}
    </text>
  )
}
