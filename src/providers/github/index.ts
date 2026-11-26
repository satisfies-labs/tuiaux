import type { components } from "@octokit/openapi-types";
import type { Job, RepoRef, Run } from "../../core/types";
import { createHttpClient, type HttpClient } from "../../services/http";
import type { ListRunsOptions, Provider } from "../types";
import { mapJob, mapRun } from "./map";

type RunsResponse = { total_count: number; workflow_runs: components["schemas"]["workflow-run"][] };
type JobsResponse = { total_count: number; jobs: components["schemas"]["job"][] };

export const githubApiBase = (host: string) =>
  host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`;

export function createGithubProvider(opts: { host: string; token: string; http?: HttpClient }): Provider {
  const http =
    opts.http ??
    createHttpClient({
      baseUrl: githubApiBase(opts.host),
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tuiaux",
      },
    });

  return {
    id: "github",
    host: opts.host,
    async listRuns(repo: RepoRef, o: ListRunsOptions = {}): Promise<Run[]> {
      const res = await http.get<RunsResponse>(`/repos/${repo.path}/actions/runs`, {
        per_page: o.limit ?? 20,
        branch: o.branch,
      });
      return res.workflow_runs.map((r) => mapRun(repo, r));
    },
    async listJobs(repo: RepoRef, runId: string): Promise<Job[]> {
      const res = await http.get<JobsResponse>(`/repos/${repo.path}/actions/runs/${runId}/jobs`, {
        per_page: 100,
      });
      return res.jobs.map(mapJob);
    },
  };
}
