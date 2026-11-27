import { Equal } from "effect"
import { Atom } from "effect/reactivity"

import type { Job, JobId, Run, RunRef } from "../../domain"
import type { FocusedRun, MonitorState } from "../../monitor"

/** The job under the cursor; an id that no longer matches falls back to `defaultJob`. */
export const jobSelectionAtom = Atom.make<JobId | undefined>(undefined)

/** What you came to see: the first failing job, else the first running one, else the first. */
export const defaultJob = (jobs: ReadonlyArray<Job>): Job | undefined =>
  jobs.find(job => job.status === "failure") ??
  jobs.find(job => job.status === "running") ??
  jobs[0]

/** The run as last listed for its repo; undefined once it falls out of the list. */
export const findRun = (state: MonitorState, ref: RunRef): Run | undefined =>
  state.entry(ref.repo)?.runs.find(run => Equal.equals(run.ref, ref))

/** The Monitor's jobs for `ref`, once it has polled them. */
export const jobsOf = (
  state: MonitorState,
  ref: RunRef,
): FocusedRun | undefined =>
  state.focusedRun !== undefined && Equal.equals(state.focusedRun.run, ref)
    ? state.focusedRun
    : undefined
