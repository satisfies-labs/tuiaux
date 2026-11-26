import type { Job, RepoRef, Run, Status } from "../../core/types";

/** Subset of the GitLab v4 API we rely on. */
export interface GlPipeline {
  id: number;
  iid: number;
  name?: string | null;
  status: string;
  source: string;
  ref: string;
  sha: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  web_url: string;
  user?: { username: string } | null;
}

export interface GlJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  web_url: string;
}

const date = (s?: string | null) => (s ? new Date(s) : undefined);

export function glStatus(s: string): Status {
  switch (s) {
    case "success":
      return "success";
    case "failed":
      return "failure";
    case "running":
      return "running";
    case "created":
    case "pending":
    case "preparing":
    case "waiting_for_resource":
    case "scheduled":
      return "queued";
    case "canceled":
    case "canceling":
      return "cancelled";
    case "skipped":
      return "skipped";
    default: // manual
      return "idle";
  }
}

export function mapPipeline(repo: RepoRef, p: GlPipeline, commitMessage = ""): Run {
  const status = glStatus(p.status);
  return {
    id: String(p.id),
    repo,
    workflow: p.name || "pipeline",
    number: p.iid,
    status,
    branch: p.ref,
    commitSha: p.sha,
    commitMessage,
    event: p.source,
    actor: p.user?.username,
    createdAt: new Date(p.created_at),
    startedAt: date(p.started_at) ?? (status === "running" ? new Date(p.created_at) : undefined),
    finishedAt: date(p.finished_at),
    url: p.web_url,
  };
}

/** GitLab jobs have no steps; the stage is exposed as a single pseudo-step for context. */
export function mapJob(j: GlJob): Job {
  return {
    id: String(j.id),
    name: j.name,
    status: glStatus(j.status),
    startedAt: date(j.started_at),
    finishedAt: date(j.finished_at),
    steps: [{ name: `stage: ${j.stage}`, status: glStatus(j.status) }],
    url: j.web_url,
  };
}
