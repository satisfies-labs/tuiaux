import type { Job, ProviderId, RepoRef, Run } from "../core/types";

export interface ListRunsOptions {
  branch?: string;
  limit?: number;
}

/**
 * The contract every CI integration implements. Providers translate a remote API into the
 * domain model (`src/core`) and know nothing about the UI, the store or the poller.
 * See docs/providers.md to add a new one.
 */
export interface Provider {
  readonly id: ProviderId;
  readonly host: string;
  listRuns(repo: RepoRef, opts?: ListRunsOptions): Promise<Run[]>;
  listJobs(repo: RepoRef, runId: string): Promise<Job[]>;
}

export class AuthMissingError extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly host: string,
  ) {
    super(
      provider === "github"
        ? `No GitHub token for ${host}. Run \`gh auth login\` or set GITHUB_TOKEN.`
        : `No GitLab token for ${host}. Run \`glab auth login\` or set GITLAB_TOKEN.`,
    );
    this.name = "AuthMissingError";
  }
}
