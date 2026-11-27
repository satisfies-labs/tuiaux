import { useTheme } from "../theme"

export type Hint = readonly [key: string, label: string]

export const KeyHints = ({
  hints,
}: {
  readonly hints: ReadonlyArray<Hint>
}) => {
  const theme = useTheme()

  return (
    <text wrapMode="none">
      {hints.map(([key, label]) => (
        <span key={key}>
          <strong fg={theme.accent}>{key}</strong>
          <span fg={theme.muted}>{` ${label}   `}</span>
        </span>
      ))}
    </text>
  )
}
