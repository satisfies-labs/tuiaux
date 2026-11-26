import type { Job, RepoRef, Run } from "../../core/types";
import { createHttpClient, type HttpClient } from "../../services/http";
import type { ListRunsOptions, Provider } from "../types";
import { type GlJob, type GlPipeline, mapJob, mapPipeline } from "./map";

export const gitlabApiBase = (host: string) => `https://${host}/api/v4`;

export function createGitlabProvider(opts: { host: string; token: string; http?: HttpClient }): Provider {
  const http =
    opts.http ??
    createHttpClient({
      baseUrl: gitlabApiBase(opts.host),
      headers: { "PRIVATE-TOKEN": opts.token, "User-Agent": "tuiaux" },
    });
  const project = (repo: RepoRef) => `/projects/${encodeURIComponent(repo.path)}`;

  return {
    id: "gitlab",
    host: opts.host,
    async listRuns(repo: RepoRef, o: ListRunsOptions = {}): Promise<Run[]> {
      const pipelines = await http.get<GlPipeline[]>(`${project(repo)}/pipelines`, {
        per_page: o.limit ?? 20,
        ref: o.branch,
      });
      // TODO(v1.1): fetch commit titles (one request per unique sha, cached) for the COMMIT column.
      return pipelines.map((p) => mapPipeline(repo, p));
    },
    async listJobs(repo: RepoRef, runId: string): Promise<Job[]> {
      const jobs = await http.get<GlJob[]>(`${project(repo)}/pipelines/${runId}/jobs`, { per_page: 100 });
      return jobs.reverse().map(mapJob); // API returns newest first; show pipeline order
    },
  };
}
