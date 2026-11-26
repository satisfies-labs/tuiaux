/**
 * Domain model shared by every layer. Provider-agnostic: no GitHub or GitLab vocabulary here.
 * This module must not import anything outside `src/core`.
 */

export type ProviderId = "github" | "gitlab" | "demo";

/** Lifecycle status of a run, job or step, normalized across providers. */
export type Status = "success" | "failure" | "running" | "queued" | "cancelled" | "skipped" | "idle";

/** The four visual tones of the brand. Every Status maps to exactly one tone. */
export type Tone = "success" | "running" | "failure" | "idle";

export interface RepoRef {
  provider: ProviderId;
  /** API host, e.g. `github.com`, `gitlab.com`, `gitlab.example.org`. */
  host: string;
  /** `owner/name` on GitHub, full namespace path on GitLab (`group/sub/project`). */
  path: string;
}

export interface Step {
  name: string;
  status: Status;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface Job {
  id: string;
  name: string;
  status: Status;
  startedAt?: Date;
  finishedAt?: Date;
  /** 0..1 when the provider can estimate it, otherwise undefined. */
  progress?: number;
  steps: Step[];
  url?: string;
}

export interface Run {
  id: string;
  repo: RepoRef;
  /** Workflow name (GitHub) or pipeline source/name (GitLab). */
  workflow: string;
  /** Human run number (`#412`). */
  number: number;
  status: Status;
  branch: string;
  commitSha: string;
  commitMessage: string;
  event: string;
  actor?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  url: string;
}

export interface RepoState {
  repo: RepoRef;
  /** Most recent runs first. */
  runs: Run[];
  /** Branch shown in the repo list (default branch or the one currently checked out). */
  branch?: string;
  lastFetchedAt?: Date;
  error?: string;
}

export const repoKey = (r: RepoRef): string => `${r.provider}:${r.host}/${r.path}`;
