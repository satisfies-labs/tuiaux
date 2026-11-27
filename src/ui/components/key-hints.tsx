import { keyLabel } from "../commands"
import { useText } from "../text"
import { useTheme } from "../theme"

export type Hint = readonly [key: string, label: string]

const GAP = "   "

/** Hints in order while they fit in `width`; `tail` is always kept, at the right end. */
export const KeyHints = ({
  hints,
  width,
  tail,
}: {
  readonly hints: ReadonlyArray<Hint>
  readonly width: number
  readonly tail?: Hint | undefined
}) => {
  const theme = useTheme()
  const text = useText()

  const cells = ([key, label]: Hint) =>
    text.width(`${keyLabel(key)} ${label}${GAP}`)

  const room = width - (tail === undefined ? 0 : cells(tail))
  const shown: Array<Hint> = []
  let used = 0

  for (const hint of hints) {
    if (used + cells(hint) > room) break
    shown.push(hint)
    used += cells(hint)
  }

  const pad = Math.max(
    0,
    width - used - (tail === undefined ? 0 : cells(tail)) + GAP.length,
  )

  return (
    <text wrapMode="none">
      {shown.map(([key, label]) => (
        <span key={`${key}-${label}`}>
          <strong fg={theme.accent}>{keyLabel(key)}</strong>
          <span fg={theme.muted}>{` ${label}${GAP}`}</span>
        </span>
      ))}
      {tail !== undefined && (
        <span>
          {" ".repeat(pad)}
          <strong fg={theme.accent}>{keyLabel(tail[0])}</strong>
          <span fg={theme.muted}>{` ${tail[1]}`}</span>
        </span>
      )}
    </text>
  )
}
