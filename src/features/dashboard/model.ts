import { Array as Arr, Duration, Option } from "effect"
import { Atom } from "effect/reactivity"

import {
  type ProviderKind,
  type RepoKey,
  type Run,
  type RunId,
  type Tone,
  duration,
  isActive,
  toneOf,
} from "../../domain"
import { type RepoEntry, RepoHealth } from "../../monitor"
import { fuzzyScore } from "../../ui"

export type DashboardPanel = "repos" | "runs"

/** What the cursor is on, by key: a list that changes under it doesn't move the selection. */
export interface Selection {
  readonly panel: DashboardPanel
  readonly repo: RepoKey | undefined
  readonly run: RunId | undefined
}

// Kept alive: the selection survives a trip to the run detail and back.
export const selectionAtom = Atom.make<Selection>({
  panel: "repos",
  repo: undefined,
  run: undefined,
}).pipe(Atom.keepAlive)

export interface RepoFilter {
  readonly query: string
  readonly failingOnly: boolean
}

export const NO_FILTER: RepoFilter = { query: "", failingOnly: false }

export const filterAtom = Atom.make<RepoFilter>(NO_FILTER).pipe(Atom.keepAlive)

export const isFiltering = (filter: RepoFilter): boolean =>
  filter.query !== "" || filter.failingOnly

const isRed = (entry: RepoEntry): boolean =>
  toneOf(entry.runs[0]?.status ?? "idle") === "failure" ||
  RepoHealth.$is("Failing")(entry.health)

/** The repos matching the query (fuzzy, on the path) and, when asked, only the red ones. */
export const applyFilter = (
  repos: ReadonlyArray<RepoEntry>,
  filter: RepoFilter,
): ReadonlyArray<RepoEntry> =>
  repos.filter(
    entry =>
      fuzzyScore(filter.query, entry.repo.path) !== undefined &&
      (!filter.failingOnly || isRed(entry)),
  )

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
