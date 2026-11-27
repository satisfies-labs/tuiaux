import type { RepoKey, RunRef } from "../../domain"
import type { MonitorState } from "../../monitor"
import { type Command, formatAge } from "../../ui"

const RECENT_RUNS = 20

/** Palette entries that jump to a repo (selects it in the dashboard) or a recent run (opens its detail). */
export const jumpCommands = (
  state: MonitorState,
  now: Date,
  go: (repo: RepoKey) => void,
  open: (run: RunRef) => void,
): ReadonlyArray<Command> => {
  const repos = state.repos.map((entry): Command => ({
    id: `repo:${entry.repo.key}`,
    title: entry.repo.path,
    group: "Repos",
    keys: [],
    status: entry.runs[0]?.status ?? "idle",
    detail: [entry.runs[0]?.branch, formatAge(entry.runs[0]?.createdAt, now)]
      .filter(part => part !== undefined)
      .join(" · "),
    run: () => go(entry.repo.key),
  }))

  const runs = state.repos
    .flatMap(entry => entry.runs)
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, RECENT_RUNS)
    .map((run): Command => ({
      id: `run:${run.ref.repo.key}:${run.ref.id}`,
      title: `${run.workflow} #${run.number} · ${run.ref.repo.path.split("/").at(-1) ?? run.ref.repo.path}`,
      group: "Runs",
      keys: [],
      status: run.status,
      detail: `${run.branch} · ${formatAge(run.createdAt, now)}`,
      run: () => open(run.ref),
    }))

  return [...repos, ...runs]
}
