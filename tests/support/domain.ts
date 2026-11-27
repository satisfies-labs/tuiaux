/** Builders for domain values in tests. Every field has a sensible default; override what the test is about. */
import { Job, JobId, JobRef, RepoRef, Run, RunId, RunRef, Step } from "../../src/domain";

export const T0 = new Date("2026-11-27T10:00:00.000Z");

export const repo = (path = "acme/api", kind: RepoRef["kind"] = "github"): RepoRef =>
  new RepoRef({ kind, host: kind === "github" ? "github.com" : "gitlab.com", path });

export const runRef = (id = "1", r: RepoRef = repo()): RunRef => new RunRef({ repo: r, id: RunId.make(id) });

export const run = (overrides: Partial<ConstructorParameters<typeof Run>[0]> = {}): Run =>
  new Run({
    ref: runRef(),
    workflow: "CI",
    number: 1,
    status: "success",
    branch: "main",
    commitSha: "a1b2c3d",
    commitMessage: "fix: things",
    event: "push",
    createdAt: T0,
    url: "https://github.com/acme/api/actions/runs/1",
    ...overrides,
  });

export const job = (overrides: Partial<ConstructorParameters<typeof Job>[0]> = {}): Job =>
  new Job({
    ref: new JobRef({ run: runRef(), id: JobId.make("10") }),
    name: "test",
    status: "success",
    steps: [new Step({ name: "checkout", status: "success" })],
    ...overrides,
  });
