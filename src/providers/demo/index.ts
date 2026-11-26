import type { Job, RepoRef, Run, Status } from "../../core/types";
import type { ListRunsOptions, Provider } from "../types";

/**
 * Fake, deterministic data that evolves over time. Powers `tuiaux --demo`:
 * development without tokens, screenshots, the README GIF and UI tests.
 */
interface Seed {
  path: string;
  provider: "github" | "gitlab";
  branch: string;
  workflow: string;
  message: string;
  status: Status;
  ageMin: number;
}

export const DEMO_SEEDS: Seed[] = [
  {
    path: "acme/web",
    provider: "github",
    branch: "main",
    workflow: "CI",
    message: "feat: pixel cloud hero",
    status: "running",
    ageMin: 1,
  },
  {
    path: "acme/api",
    provider: "github",
    branch: "main",
    workflow: "CI",
    message: "fix: retry webhooks",
    status: "failure",
    ageMin: 12,
  },
  {
    path: "acme/game",
    provider: "github",
    branch: "feat/horror",
    workflow: "Build",
    message: "wip: fog shader",
    status: "running",
    ageMin: 0,
  },
  {
    path: "acme/tuiaux",
    provider: "github",
    branch: "main",
    workflow: "CI",
    message: "chore: release 0.1.0",
    status: "success",
    ageMin: 4,
  },
  {
    path: "acme/dotfiles",
    provider: "github",
    branch: "main",
    workflow: "Lint",
    message: "nvim: lsp tweaks",
    status: "success",
    ageMin: 1440,
  },
  {
    path: "team/ui-kit",
    provider: "gitlab",
    branch: "develop",
    workflow: "pipeline",
    message: "feat: tooltip",
    status: "success",
    ageMin: 25,
  },
  {
    path: "team/backend",
    provider: "gitlab",
    branch: "develop",
    workflow: "pipeline",
    message: "perf: batch inserts",
    status: "success",
    ageMin: 60,
  },
  {
    path: "team/docs",
    provider: "gitlab",
    branch: "main",
    workflow: "pipeline",
    message: "—",
    status: "idle",
    ageMin: 0,
  },
];

const JOBS = ["install", "lint", "typecheck", "test", "build", "deploy"];
const CYCLE_MS = 90_000;

export const demoRepos = (): RepoRef[] =>
  DEMO_SEEDS.map((s) => ({
    provider: s.provider,
    host: s.provider === "github" ? "github.com" : "gitlab.com",
    path: s.path,
  }));

export function createDemoProvider(now: () => number = Date.now): Provider {
  const t0 = now();
  const seedOf = (repo: RepoRef) => DEMO_SEEDS.find((s) => s.path === repo.path);

  /** Running seeds advance through a 90s cycle, then settle on success (or failure for `game`). */
  const progressOf = (seed: Seed) => {
    if (seed.status !== "running") return 1;
    const offset = seed.path.length * 7_000;
    return Math.min(1, (now() - t0 + offset) / CYCLE_MS);
  };

  const statusOf = (seed: Seed): Status => {
    if (seed.status !== "running") return seed.status;
    return progressOf(seed) < 1 ? "running" : seed.path.endsWith("game") ? "failure" : "success";
  };

  return {
    id: "demo",
    host: "demo",
    async listRuns(repo: RepoRef, o: ListRunsOptions = {}): Promise<Run[]> {
      const seed = seedOf(repo);
      if (!seed || seed.status === "idle") return [];
      const base = now() - seed.ageMin * 60_000;
      const runs: Run[] = Array.from({ length: Math.min(o.limit ?? 8, 8) }, (_, i) => {
        const created = new Date(base - i * 47 * 60_000);
        const status: Status = i === 0 ? statusOf(seed) : i === 3 ? "failure" : "success";
        const duration = 95_000 + ((i * 13_000) % 60_000);
        return {
          id: `${seed.path}#${412 - i}`,
          repo,
          workflow: i % 4 === 1 ? "Deploy" : seed.workflow,
          number: 412 - i,
          status,
          branch: i === 3 ? "feat/works" : seed.branch,
          commitSha: (0xa3f9c2e - i * 4099).toString(16).padStart(7, "0"),
          commitMessage:
            i === 0
              ? seed.message
              : (["fix: og image size", "chore: bump deps", "wip: works grid"][i % 3] ?? ""),
          event: i === 3 ? "pull_request" : "push",
          actor: "Satisfies Labs",
          createdAt: created,
          startedAt: created,
          finishedAt: status === "running" ? undefined : new Date(created.getTime() + duration),
          url: `https://${repo.host}/${repo.path}`,
        };
      });
      return runs;
    },
    async listJobs(repo: RepoRef, runId: string): Promise<Job[]> {
      const seed = seedOf(repo);
      const latest = runId.endsWith("#412");
      const p = seed && latest ? progressOf(seed) : 1;
      const failed = seed && latest && statusOf(seed) === "failure";
      const base = now() - p * CYCLE_MS;
      return JOBS.map((name, i) => {
        const start = i / JOBS.length;
        const end = (i + 1) / JOBS.length;
        const local = Math.max(0, Math.min(1, (p - start) / (end - start)));
        let status: Status = local >= 1 ? "success" : local > 0 ? "running" : "queued";
        if (failed && name === "test") status = "failure";
        if (failed && i > JOBS.indexOf("test")) status = "skipped";
        const started = local > 0 && status !== "skipped";
        return {
          id: `${runId}/${name}`,
          name,
          status,
          startedAt: started ? new Date(base + start * CYCLE_MS) : undefined,
          finishedAt:
            started && status !== "running" ? new Date(base + Math.min(p, end) * CYCLE_MS) : undefined,
          progress: status === "running" ? local : undefined,
          steps: [],
        };
      });
    },
  };
}
