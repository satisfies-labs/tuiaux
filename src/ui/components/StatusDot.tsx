import { GLYPH, toneOf } from "../../core/status";
import type { Status } from "../../core/types";
import { useTheme } from "../context";
import { useSpinner } from "../hooks";

/** The brand's living dot. Running statuses spin; color always comes from the theme's status tokens. */
export function StatusDot({ status, animate = true }: { status: Status; animate?: boolean }) {
  const theme = useTheme();
  const frame = useSpinner(animate && status === "running");
  const glyph = status === "running" && animate ? frame : GLYPH[status];
  return <span fg={theme[toneOf(status)]}>{glyph}</span>;
}
