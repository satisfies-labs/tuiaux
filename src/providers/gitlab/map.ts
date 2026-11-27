import {
  Job,
  JobId,
  JobRef,
  type RepoRef,
  Run,
  RunId,
  RunRef,
  type Status,
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

/** The REST id inside a GraphQL global id: `gid://gitlab/Ci::Pipeline/123` → `123`. */
const restId = (globalId: string) =>
  globalId.slice(globalId.lastIndexOf("/") + 1)

export const mapPipeline = (repo: RepoRef, payload: GlPipeline): Run =>
  new Run({
    ref: new RunRef({ repo, id: RunId.make(restId(payload.id)) }),
    workflow: payload.name ?? payload.source ?? "pipeline",
    number: payload.iid,
    status: glStatus(payload.status.toLowerCase()),
    branch: payload.ref ?? "",
    commitSha: payload.sha,
    commitMessage: payload.commit?.title,
    event: payload.source ?? "",
    actor: payload.user?.username,
    createdAt: payload.createdAt,
    startedAt: payload.startedAt ?? undefined,
    finishedAt: payload.finishedAt ?? undefined,
    url: `https://${repo.host}${payload.path}`,
  })

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
