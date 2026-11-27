import { Effect, Option } from "effect"
import { Headers } from "effect/http"

import { RepoRef } from "../../domain"
import { parseGitUrl } from "../../platform"
import type { Provider, ProviderModule } from "../provider"
import { restClient } from "../rest"
import { GhJobsPage, GhRunsPage } from "./api"
import { mapJob, mapRun } from "./map"

const HOST = "github.com"

/** `owner/name`, each segment URL-encoded. */
const repoPath = (repo: RepoRef) =>
  repo.path.split("/").map(encodeURIComponent).join("/")

/** GitHub Actions on github.com. Tokens come from `gh auth token`. */
export const GitHub: ProviderModule = {
  kind: "github",

  matchRemote: url =>
    parseGitUrl(url).pipe(
      Option.filter(
        remote => remote.host === HOST && remote.path.split("/").length === 2,
      ),
      Option.map(
        remote =>
          new RepoRef({ kind: "github", host: HOST, path: remote.path }),
      ),
    ),

  make: Effect.gen(function* () {
    const rest = yield* restClient({
      kind: "github",
      host: HOST,
      baseUrl: "https://api.github.com",
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
      cli: {
        command: "gh",
        args: ["auth", "token", "--hostname", HOST],
        login: "gh auth login",
        install: "https://cli.github.com",
      },
      rateLimitResetHeader: "x-ratelimit-reset",
      // GitHub answers 403 (not only 429) when the primary or secondary quota is spent.
      isRateLimit403: response =>
        Option.contains(
          Headers.get(response.headers, "x-ratelimit-remaining"),
          "0",
        ) || Headers.has(response.headers, "retry-after"),
      forbiddenHint:
        "The token can't read Actions here: run `gh auth refresh -s repo`.",
    })

    return {
      kind: "github",
      capabilities: { rerun: false, cancel: false, logs: "none" },

      listRuns: (repo, opts) =>
        rest
          .get(
            GhRunsPage,
            `/repos/${repoPath(repo)}/actions/runs`,
            { per_page: opts.limit, branch: opts.branch },
            { repo, resource: "repo" },
          )
          .pipe(
            Effect.map(page =>
              page.workflow_runs.map(run => mapRun(repo, run)),
            ),
          ),

      listJobs: run =>
        rest
          .get(
            GhJobsPage,
            `/repos/${repoPath(run.repo)}/actions/runs/${encodeURIComponent(run.id)}/jobs`,
            { per_page: 100 },
            { repo: run.repo, resource: "run" },
          )
          .pipe(Effect.map(page => page.jobs.map(job => mapJob(run, job)))),
    } satisfies Provider
  }),
}
