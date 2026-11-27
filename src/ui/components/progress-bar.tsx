import { type Status, toneOf } from "../../domain"
import { useTheme } from "../theme"

/** `width` cells filled to `value` (0..1), in the status tone. */
export const ProgressBar = ({
  value,
  width,
  status,
}: {
  readonly value: number
  readonly width: number
  readonly status: Status
}) => {
  const theme = useTheme()
  const filled = Math.round(Math.min(1, Math.max(0, value)) * width)

  return (
    <>
      <span fg={theme[toneOf(status)]}>{"█".repeat(filled)}</span>
      <span fg={theme.line}>{"░".repeat(width - filled)}</span>
    </>
  )
}
