import {
  Job,
  JobId,
  JobRef,
  type RepoRef,
  Run,
  RunId,
  RunRef,
  type Status,
  Step,
  isActive,
} from "../../domain"
import type { GhJob, GhRun, GhStep } from "./api"

/** Pure payload → domain mapping for GitHub Actions. */

/** GitHub splits state into `status` + `conclusion`; fold them into one Status. Unknown → idle. */
export const ghStatus = (
  status: string | null,
  conclusion: string | null,
): Status => {
  switch (status) {
    case "queued":
    case "waiting":
    case "requested":
    case "pending":
      return "queued"
    case "in_progress":
      return "running"
  }

  switch (conclusion) {
    case "success":
    case "neutral":
      return "success"
    case "failure":
    case "timed_out":
    case "startup_failure":
    case "action_required":
      return "failure"
    case "cancelled":
    case "stale":
      return "cancelled"
    case "skipped":
      return "skipped"
    default:
      return "idle"
  }
}

/** First line of a commit title; undefined when blank. */
const firstLine = (text: string | undefined): string | undefined => {
  const line = text?.split("\n")[0]?.trim()

  return line === "" ? undefined : line
}

export const mapRun = (repo: RepoRef, payload: GhRun): Run => {
  const status = ghStatus(payload.status, payload.conclusion)

  return new Run({
    ref: new RunRef({ repo, id: RunId.make(String(payload.id)) }),
    workflow: payload.name ?? "workflow",
    number: payload.run_number,
    status,
    branch: payload.head_branch ?? "",
    commitSha: payload.head_sha,
    commitMessage: firstLine(payload.display_title),
    event: payload.event,
    actor: payload.actor?.login,
    createdAt: payload.created_at,
    startedAt: payload.run_started_at ?? undefined,
    // The list has no completion time; `updated_at` is when it settled.
    finishedAt: payload.status === "completed" ? payload.updated_at : undefined,
    url: payload.html_url,
  })
}

const mapStep = (payload: GhStep): Step =>
  new Step({
    name: payload.name,
    status: ghStatus(payload.status, payload.conclusion),
    startedAt: payload.started_at ?? undefined,
    finishedAt: payload.completed_at ?? undefined,
  })

export const mapJob = (run: RunRef, payload: GhJob): Job => {
  const status = ghStatus(payload.status, payload.conclusion)

  const steps = (payload.steps ?? [])
    .toSorted((a, b) => a.number - b.number)
    .map(mapStep)

  const done = steps.filter(step => !isActive(step.status)).length

  return new Job({
    ref: new JobRef({ run, id: JobId.make(String(payload.id)) }),
    name: payload.name,
    stage: undefined,
    status,
    startedAt: payload.started_at ?? undefined,
    finishedAt: payload.completed_at ?? undefined,
    progress:
      status === "running" && steps.length > 0
        ? done / steps.length
        : undefined,
    steps,
    url: payload.html_url ?? undefined,
  })
}
