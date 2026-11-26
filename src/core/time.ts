/** `0:42`, `12:07`, `1:02:33` — durations as shown in the TUI. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** `now`, `42s`, `12m`, `3h`, `2d`, `5w` — compact relative age. */
export function formatAge(date: Date | undefined, now: Date = new Date()): string {
  if (!date) return "—";
  const s = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (s < 10) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / (86400 * 7))}w`;
}

export const elapsed = (start?: Date, end?: Date, now: Date = new Date()): number =>
  start ? (end ?? now).getTime() - start.getTime() : Number.NaN;

/** Truncate to `max` terminal cells with an ellipsis. */
export function truncate(s: string, max: number): string {
  if (max <= 0) return "";
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}
