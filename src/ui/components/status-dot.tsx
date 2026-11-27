import { type Status, toneOf } from "../../domain"
import { useTheme } from "../theme"

const GLYPH: Record<Status, string> = {
  success: "●",
  failure: "●",
  running: "◌",
  queued: "○",
  cancelled: "○",
  skipped: "○",
  idle: "○",
}

const SPINNER = ["◐", "◓", "◑", "◒"]

/** The brand's dot: the only colored mark, always in its status tone. Given `now`, a running dot spins. */
export const StatusDot = ({
  status,
  now,
}: {
  readonly status: Status
  readonly now?: Date | undefined
}) => (
  <span fg={useTheme()[toneOf(status)]}>
    {status === "running" && now !== undefined
      ? (SPINNER[Math.floor(now.getTime() / 1000) % SPINNER.length] ??
        GLYPH.running)
      : GLYPH[status]}
  </span>
)
