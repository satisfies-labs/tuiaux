import { expect, test } from "bun:test";
import { createGitlabProvider } from "../../src/providers/gitlab";
import type { HttpClient } from "../../src/services/http";
import pipelines from "../fixtures/gitlab/pipelines.json";

test("gitlab: url-encodes nested project paths and maps pipelines", async () => {
  const paths: string[] = [];
  const http: HttpClient = {
    rateLimit: undefined,
    async get<T>(path: string) {
      paths.push(path);
      return pipelines as T;
    },
  };
  const repo = { provider: "gitlab" as const, host: "gitlab.com", path: "team/sub/web" };
  const runs = await createGitlabProvider({ host: "gitlab.com", token: "x", http }).listRuns(repo);
  expect(paths[0]).toBe("/projects/team%2Fsub%2Fweb/pipelines");
  expect(runs.map((r) => [r.number, r.status, r.workflow])).toEqual([
    [87, "failure", "pipeline"],
    [86, "idle", "nightly"],
  ]);
});
