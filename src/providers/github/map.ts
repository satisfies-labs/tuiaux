import type { components } from "@octokit/openapi-types";
import type { Job, RepoRef, Run, Status } from "../../core/types";

type GhRun = components["schemas"]["workflow-run"];
type GhJob = components["schemas"]["job"];
type GhStep = NonNullable<GhJob["steps"]>[number];

const date = (s?: string | null) => (s ? new Date(s) : undefined);

/** GitHub splits state into `status` + `conclusion`; fold them into one Status. */
export function ghStatus(status?: string | null, conclusion?: string | null): Status {
  switch (status) {
    case "queued":
    case "waiting":
    case "requested":
    case "pending":
      return "queued";
    case "in_progress":
      return "running";
  }
  switch (conclusion) {
    case "success":
    case "neutral":
      return "success";
    case "failure":
    case "timed_out":
    case "startup_failure":
    case "action_required":
      return "failure";
    case "cancelled":
    case "stale":
      return "cancelled";
    case "skipped":
      return "skipped";
    default:
      return "idle";
  }
}

export function mapRun(repo: RepoRef, r: GhRun): Run {
  return {
    id: String(r.id),
    repo,
    workflow: r.name ?? "workflow",
    number: r.run_number,
    status: ghStatus(r.status, r.conclusion),
    branch: r.head_branch ?? "",
    commitSha: r.head_sha,
    commitMessage: (r.display_title || r.head_commit?.message || "").split("\n")[0] ?? "",
    event: r.event,
    actor: r.actor?.login,
    createdAt: new Date(r.created_at),
    startedAt: date(r.run_started_at),
    finishedAt: r.status === "completed" ? date(r.updated_at) : undefined,
    url: r.html_url,
  };
}

const mapStep = (s: GhStep) => ({
  name: s.name,
  status: ghStatus(s.status, s.conclusion),
  startedAt: date(s.started_at),
  finishedAt: date(s.completed_at),
});

export function mapJob(j: GhJob): Job {
  const steps = (j.steps ?? []).map(mapStep);
  const done = steps.filter((s) => s.status !== "running" && s.status !== "queued").length;
  const status = ghStatus(j.status, j.conclusion);
  return {
    id: String(j.id),
    name: j.name,
    status,
    startedAt: date(j.started_at),
    finishedAt: date(j.completed_at),
    progress: status === "running" && steps.length > 0 ? done / steps.length : undefined,
    steps,
    url: j.html_url ?? undefined,
  };
}
