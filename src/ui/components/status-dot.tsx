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

/** The brand's dot: the only colored mark, always in its status tone. */
export const StatusDot = ({ status }: { readonly status: Status }) => (
  <span fg={useTheme()[toneOf(status)]}>{GLYPH[status]}</span>
)
