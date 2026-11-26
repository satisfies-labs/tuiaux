import { describe, expect, test } from "bun:test";
import { createGithubProvider } from "../../src/providers/github";
import { ghStatus } from "../../src/providers/github/map";
import type { HttpClient } from "../../src/services/http";
import jobs from "../fixtures/github/jobs.json";
import runs from "../fixtures/github/runs.json";

const repo = { provider: "github" as const, host: "github.com", path: "satisfies-labs/tuiaux" };
const fakeHttp = (routes: Record<string, unknown>): HttpClient => ({
  rateLimit: undefined,
  async get<T>(path: string) {
    const hit = Object.entries(routes).find(([k]) => path.endsWith(k));
    if (!hit) throw new Error(`no route for ${path}`);
    return hit[1] as T;
  },
});

describe("github provider", () => {
  const provider = createGithubProvider({
    host: "github.com",
    token: "x",
    http: fakeHttp({ "/actions/runs": runs, "/jobs": jobs }),
  });

  test("maps workflow runs", async () => {
    const [latest, previous] = await provider.listRuns(repo);
    expect(latest).toMatchObject({
      id: "1001",
      number: 412,
      status: "running",
      branch: "main",
      commitMessage: "feat: pixel cloud hero",
      actor: "Satisfies Labs",
    });
    expect(latest?.finishedAt).toBeUndefined();
    expect(previous).toMatchObject({ status: "failure", commitMessage: "wip: works grid" });
  });

  test("maps jobs with steps and progress", async () => {
    const [job] = await provider.listJobs(repo, "1001");
    expect(job).toMatchObject({ name: "test", status: "running", progress: 0.5 });
    expect(job?.steps.map((s) => s.status)).toEqual(["success", "running"]);
  });

  test("status folding", () => {
    expect(ghStatus("queued", null)).toBe("queued");
    expect(ghStatus("completed", "cancelled")).toBe("cancelled");
    expect(ghStatus("completed", "skipped")).toBe("skipped");
    expect(ghStatus("completed", "startup_failure")).toBe("failure");
  });
});
