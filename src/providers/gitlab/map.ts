import {
  Job,
  JobId,
  JobRef,
  type RepoRef,
  Run,
  RunId,
  RunRef,
  type Status,
  isActive,
} from "../../domain"
import type { GlJob, GlPipeline } from "./api"

/** Pure payload → domain mapping for GitLab CI. */

/** One GitLab state → Status. `manual` (waiting for someone) and unknown states → idle. */
export const glStatus = (status: string): Status => {
  switch (status) {
    case "success":
      return "success"
    case "failed":
      return "failure"
    case "running":
      return "running"
    case "created":
    case "pending":
    case "preparing":
    case "waiting_for_resource":
    case "waiting_for_callback":
    case "scheduled":
      return "queued"
    case "canceled":
    case "canceling":
      return "cancelled"
    case "skipped":
      return "skipped"
    default:
      return "idle"
  }
}

/**
 * The pipeline list has no start/finish times and no commit title (one request per pipeline would be
 * needed). Times are estimated from `created_at` (start) and `updated_at` (when it settled).
 */
export const mapPipeline = (repo: RepoRef, payload: GlPipeline): Run => {
  const status = glStatus(payload.status)
  const started = status !== "queued" && status !== "idle"

  return new Run({
    ref: new RunRef({ repo, id: RunId.make(String(payload.id)) }),
    workflow: payload.name ?? payload.source,
    number: payload.iid,
    status,
    branch: payload.ref,
    commitSha: payload.sha,
    commitMessage: undefined,
    event: payload.source,
    actor: undefined,
    createdAt: payload.created_at,
    startedAt: started ? payload.created_at : undefined,
    finishedAt: started && !isActive(status) ? payload.updated_at : undefined,
    url: payload.web_url,
  })
}

/** GitLab jobs have no steps; they're grouped by `stage` instead. */
export const mapJob = (run: RunRef, payload: GlJob): Job =>
  new Job({
    ref: new JobRef({ run, id: JobId.make(String(payload.id)) }),
    name: payload.name,
    stage: payload.stage,
    status: glStatus(payload.status),
    startedAt: payload.started_at ?? undefined,
    finishedAt: payload.finished_at ?? undefined,
    progress: undefined,
    steps: [],
    url: payload.web_url,
  })
