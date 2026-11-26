import { describe, expect, test } from "bun:test";
import { aggregate, exitCodeOf, sortByUrgency, summarize, toneOf } from "../../src/core/status";
import type { RepoState, Run, Status } from "../../src/core/types";

const run = (status: Status, minutesAgo = 0): Run => ({
  id: `${status}-${minutesAgo}`,
  repo: { provider: "github", host: "github.com", path: "a/b" },
  workflow: "CI",
  number: 1,
  status,
  branch: "main",
  commitSha: "abc",
  commitMessage: "",
  event: "push",
  createdAt: new Date(Date.now() - minutesAgo * 60_000),
  url: "",
});
const repo = (path: string, ...runs: Run[]): RepoState => ({
  repo: { provider: "github", host: "github.com", path },
  runs,
});

describe("status", () => {
  test("every status maps to one of the four brand tones", () => {
    expect(toneOf("queued")).toBe("idle");
    expect(toneOf("cancelled")).toBe("idle");
    expect(toneOf("running")).toBe("running");
  });

  test("sortByUrgency puts failures, then running, first", () => {
    const sorted = sortByUrgency([
      repo("ok", run("success")),
      repo("run", run("running")),
      repo("ko", run("failure")),
      repo("empty"),
    ]);
    expect(sorted.map((r) => r.repo.path)).toEqual(["ko", "run", "ok", "empty"]);
  });

  test("summarize counts by tone", () => {
    expect(summarize([repo("a", run("success")), repo("b", run("queued")), repo("c")])).toEqual({
      total: 3,
      success: 1,
      running: 0,
      failure: 0,
      idle: 2,
    });
  });

  test("aggregate: failure wins, then running", () => {
    expect(aggregate(["success", "running", "failure"])).toBe("failure");
    expect(aggregate(["success", "running"])).toBe("running");
    expect(aggregate(["success", "skipped"])).toBe("success");
    expect(aggregate([])).toBe("idle");
  });

  test("exit codes", () => {
    expect(exitCodeOf(run("success"))).toBe(0);
    expect(exitCodeOf(run("failure"))).toBe(1);
    expect(exitCodeOf(run("cancelled"))).toBe(2);
    expect(exitCodeOf(undefined)).toBe(2);
  });
});
