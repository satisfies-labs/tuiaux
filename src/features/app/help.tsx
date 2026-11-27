import { Dialog, type Hint, useText, useTheme } from "../../ui"

/** Every key of the current view, one per line. */
export const Help = ({ hints }: { readonly hints: ReadonlyArray<Hint> }) => {
  const theme = useTheme()
  const { fit } = useText()

  return (
    <Dialog title="keys">
      {[...hints, ["esc", "close"] as const].map(([key, label]) => (
        <text key={key} wrapMode="none">
          <strong fg={theme.accent}>{fit(key, 6)}</strong>
          <span fg={theme.text}>{label}</span>
        </text>
      ))}
    </Dialog>
  )
}
