import { toneOf } from "../../core/status";
import type { Status } from "../../core/types";
import { useTheme } from "../context";

export function ProgressBar({ value, width, status }: { value: number; width: number; status: Status }) {
  const theme = useTheme();
  const v = Math.max(0, Math.min(1, value));
  const filled = Math.round(v * width);
  return (
    <>
      <span fg={theme[toneOf(status)]}>{"█".repeat(filled)}</span>
      <span fg={theme.line}>{"░".repeat(width - filled)}</span>
    </>
  );
}
