import type { RepoState, Run, Status, Tone } from "./types";

const TONE: Record<Status, Tone> = {
  success: "success",
  failure: "failure",
  running: "running",
  queued: "idle",
  cancelled: "idle",
  skipped: "idle",
  idle: "idle",
};

export const toneOf = (s: Status): Tone => TONE[s];

/** Glyph per status. `running` is animated by the UI (spinner frames), this is the static fallback. */
export const GLYPH: Record<Status, string> = {
  success: "●",
  failure: "●",
  running: "◌",
  queued: "○",
  cancelled: "○",
  skipped: "○",
  idle: "○",
};

/** Lower = more urgent. Drives the default "sort by status". */
const URGENCY: Record<Status, number> = {
  failure: 0,
  running: 1,
  queued: 2,
  cancelled: 3,
  success: 4,
  skipped: 5,
  idle: 6,
};

export const isActive = (s: Status): boolean => s === "running" || s === "queued";

/** The status that represents a repo: its latest run, or idle when it has none. */
export const repoStatus = (r: RepoState): Status => r.runs[0]?.status ?? "idle";

export function sortByUrgency(repos: readonly RepoState[]): RepoState[] {
  return [...repos].sort((a, b) => {
    const d = URGENCY[repoStatus(a)] - URGENCY[repoStatus(b)];
    if (d !== 0) return d;
    const ta = a.runs[0]?.createdAt.getTime() ?? 0;
    const tb = b.runs[0]?.createdAt.getTime() ?? 0;
    return tb - ta;
  });
}

export interface Summary {
  total: number;
  success: number;
  running: number;
  failure: number;
  idle: number;
}

export function summarize(repos: readonly RepoState[]): Summary {
  const s: Summary = { total: repos.length, success: 0, running: 0, failure: 0, idle: 0 };
  for (const r of repos) s[toneOf(repoStatus(r))]++;
  return s;
}

/** Overall status of a run, given its jobs: failure wins, then running, then queued. */
export function aggregate(statuses: readonly Status[]): Status {
  if (statuses.length === 0) return "idle";
  for (const s of ["failure", "running", "queued"] as const) if (statuses.includes(s)) return s;
  if (statuses.every((s) => s === "skipped")) return "skipped";
  if (statuses.some((s) => s === "cancelled")) return "cancelled";
  return "success";
}

/** Exit code for `tuiaux watch` / `tuiaux status`: 0 success, 1 failure, 2 other. */
export const exitCodeOf = (r: Run | undefined): number =>
  !r ? 2 : r.status === "success" ? 0 : r.status === "failure" ? 1 : 2;
