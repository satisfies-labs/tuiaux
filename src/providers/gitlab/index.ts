import { Effect, Option } from "effect"

import { RepoRef } from "../../domain"
import { parseGitUrl } from "../../platform"
import type { Provider, ProviderModule } from "../provider"
import { restClient } from "../rest"
import { GlJobsPage, GlPipelinesPage } from "./api"
import { mapJob, mapPipeline } from "./map"

const HOST = "gitlab.com"

/** GitLab addresses a project by its full path, URL-encoded as one segment. */
const project = (repo: RepoRef) => `/projects/${encodeURIComponent(repo.path)}`

/** GitLab CI on gitlab.com. Tokens come from `glab`. */
export const GitLab: ProviderModule = {
  kind: "gitlab",

  matchRemote: url =>
    parseGitUrl(url).pipe(
      Option.filter(remote => remote.host === HOST),
      Option.map(
        remote =>
          new RepoRef({ kind: "gitlab", host: HOST, path: remote.path }),
      ),
    ),

  make: Effect.gen(function* () {
    const rest = yield* restClient({
      kind: "gitlab",
      host: HOST,
      baseUrl: `https://${HOST}/api/v4`,
      headers: { accept: "application/json" },
      cli: {
        command: "glab",
        args: ["config", "get", "token", "--host", HOST],
        login: "glab auth login",
        install: "https://gitlab.com/gitlab-org/cli",
      },
      rateLimitResetHeader: "ratelimit-reset",
      // GitLab always uses 429 for rate limits.
      isRateLimit403: () => false,
      forbiddenHint:
        "The token can't read this project: it needs the `read_api` scope.",
    })

    return {
      kind: "gitlab",
      capabilities: { rerun: false, cancel: false, logs: "none" },

      listRuns: (repo, opts) =>
        rest
          .get(
            GlPipelinesPage,
            `${project(repo)}/pipelines`,
            { per_page: opts.limit, ref: opts.branch },
            { repo, resource: "repo" },
          )
          .pipe(
            Effect.map(page =>
              page.map(pipeline => mapPipeline(repo, pipeline)),
            ),
          ),

      listJobs: run =>
        rest
          .get(
            GlJobsPage,
            `${project(run.repo)}/pipelines/${encodeURIComponent(run.id)}/jobs`,
            { per_page: 100 },
            { repo: run.repo, resource: "run" },
          )
          .pipe(
            // Newest first in the API; ids follow creation, which is pipeline order.
            Effect.map(page =>
              page.toSorted((a, b) => a.id - b.id).map(job => mapJob(run, job)),
            ),
          ),
    } satisfies Provider
  }),
}
