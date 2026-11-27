import { Array as Arr, Duration, Option } from "effect"
import { Atom } from "effect/reactivity"

import {
  type ProviderKind,
  type RepoKey,
  type RepoRef,
  type Run,
  type RunId,
  type Tone,
  duration,
  isActive,
  toneOf,
} from "../../domain"
import type { RepoEntry } from "../../monitor"

export type DashboardPanel = "repos" | "runs"

/** What the cursor is on, by key: a list that changes under it doesn't move the selection. */
export interface Selection {
  readonly panel: DashboardPanel
  readonly repo: RepoKey | undefined
  readonly run: RunId | undefined
}

export const selectionAtom = Atom.make<Selection>({
  panel: "repos",
  repo: undefined,
  run: undefined,
})

/** The repo waiting for a forget confirmation. */
export const forgetAtom = Atom.make<RepoRef | undefined>(undefined)

export interface ProviderGroup {
  readonly kind: ProviderKind
  readonly repos: ReadonlyArray<RepoEntry>
}

/** Repos grouped by provider, groups and repos in Monitor order (the current repo's group first). */
export const groupByProvider = (
  repos: ReadonlyArray<RepoEntry>,
): ReadonlyArray<ProviderGroup> =>
  Object.values(Arr.groupBy(repos, entry => entry.repo.kind)).map(entries => ({
    kind: entries[0].repo.kind,
    repos: entries,
  }))

/** The key `delta` steps away from `current` in `keys`, clamped to the ends. */
export const moveBy = <K>(
  keys: ReadonlyArray<K>,
  current: K | undefined,
  delta: number,
): K | undefined => {
  const index = current === undefined ? 0 : Math.max(0, keys.indexOf(current))

  return keys[Math.min(keys.length - 1, Math.max(0, index + delta))]
}

/** How many repos show each tone, by their latest run. */
export const tally = (
  repos: ReadonlyArray<RepoEntry>,
): Readonly<Record<Tone, number>> => {
  const count = (tone: Tone) =>
    repos.filter(entry => toneOf(entry.runs[0]?.status ?? "idle") === tone)
      .length

  return {
    success: count("success"),
    running: count("running"),
    failure: count("failure"),
    idle: count("idle"),
  }
}

export interface RunStats {
  readonly average: Option.Option<Duration.Duration>
  /** Share of successes among runs that passed or failed. */
  readonly okRatio: Option.Option<number>
}

/** Average duration and success rate of the settled runs listed. */
export const runStats = (runs: ReadonlyArray<Run>): RunStats => {
  const settled = runs.filter(run => !isActive(run.status))

  const durations = settled.flatMap(run => Option.toArray(duration(run)))

  const judged = settled.filter(
    run => run.status === "success" || run.status === "failure",
  )

  return {
    average:
      durations.length === 0
        ? Option.none()
        : Option.some(
            Duration.divideUnsafe(
              durations.reduce(Duration.sum, Duration.zero),
              durations.length,
            ),
          ),
    okRatio:
      judged.length === 0
        ? Option.none()
        : Option.some(
            judged.filter(run => run.status === "success").length /
              judged.length,
          ),
  }
}
