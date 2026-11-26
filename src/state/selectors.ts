import { sortByUrgency } from "../core/status";
import { type RepoState, type Run, repoKey } from "../core/types";
import type { AppState } from "./store";

/** Derived view-model: everything the views need, computed from the raw store state. */
export function viewModel(s: AppState) {
  const repos = sortByUrgency(s.repoOrder.map((k) => s.repos[k]).filter((r): r is RepoState => !!r));
  const repo = repos.find((r) => repoKey(r.repo) === s.selectedRepo) ?? repos[0];
  const runs = repo?.runs ?? [];
  const run: Run | undefined = runs.find((r) => r.id === s.selectedRun) ?? runs[0];
  const jobsState = run ? s.jobs[run.id] : undefined;
  const jobs = jobsState?.jobs ?? [];
  const job = jobs.find((j) => j.id === s.selectedJob) ?? jobs.find((j) => j.status === "failure") ?? jobs[0];
  return { repos, repo, runs, run, jobs, jobsError: jobsState?.error, job };
}

export type ViewModel = ReturnType<typeof viewModel>;

/** Move a selection by `delta` inside `ids`, clamped. */
export function step(ids: string[], current: string | undefined, delta: number): string | undefined {
  if (ids.length === 0) return undefined;
  const i = current ? ids.indexOf(current) : 0;
  return ids[Math.max(0, Math.min(ids.length - 1, Math.max(0, i) + delta))];
}
