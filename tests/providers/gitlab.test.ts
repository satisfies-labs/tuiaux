import { describe, expect } from "bun:test"
import { Effect, Option } from "effect"

import {
  AuthMissing,
  NotFound,
  RateLimited,
  RepoRef,
  RunId,
  RunRef,
  type Status,
  Unauthorized,
  Unexpected,
} from "../../src/domain"
import { GitLab } from "../../src/providers/gitlab"
import { glStatus } from "../../src/providers/gitlab/map"
import type { Provider } from "../../src/providers/provider"
import type { FakeReply, SentRequest } from "../fakes/http-client"
import type { FakeBinary } from "../fakes/spawner"
import jobsPayload from "../fixtures/gitlab/jobs.json"
import pipelinesPayload from "../fixtures/gitlab/pipelines.json"
import { it } from "../support/effect"
import { always, failsWith, withProvider } from "../support/providers"

const repo = new RepoRef({
  kind: "gitlab",
  host: "gitlab.com",
  path: "team/sub/web",
})

const run = new RunRef({ repo, id: RunId.make("9001") })

const LOGGED_IN: FakeBinary = { exitCode: 0, stdout: "glpat-secret\n" }

const OPTS = { branch: undefined, limit: 20 }

const withGitLab = <A, E>(
  route: (request: SentRequest) => FakeReply,
  use: (provider: Provider) => Effect.Effect<A, E>,
  glab: FakeBinary = LOGGED_IN,
) => withProvider(GitLab, "glab", route, use, glab)

describe("listRuns", () => {
  it.effect(
    "maps pipelines, estimating times from created/updated",
    () =>
      withGitLab(always({ status: 200, body: pipelinesPayload }), gitlab =>
        Effect.gen(function* () {
          const [failed, manual] = yield* gitlab.listRuns(repo, OPTS)

          expect(failed).toMatchObject({
            workflow: "push",
            number: 87,
            status: "failure",
            branch: "main",
            commitSha: "c0ffee00",
            commitMessage: undefined,
            event: "push",
            startedAt: new Date("2026-11-26T19:00:00Z"),
            finishedAt: new Date("2026-11-26T19:01:00Z"),
            url: "https://gitlab.com/team/web/-/pipelines/9001",
          })
          expect(failed?.ref.id).toBe(RunId.make("9001"))
          expect(manual).toMatchObject({
            workflow: "nightly",
            status: "idle",
            event: "schedule",
            startedAt: undefined,
            finishedAt: undefined,
          })
        }),
      ).effect,
  )

  it.effect("addresses the project by its encoded full path", () => {
    const setup = withGitLab(
      always({ status: 200, body: pipelinesPayload }),
      gitlab =>
        Effect.gen(function* () {
          yield* gitlab.listRuns(repo, { branch: "develop", limit: 5 })
          yield* gitlab.listRuns(repo, OPTS)
        }),
    )

    return setup.effect.pipe(
      Effect.map(() => {
        const [first, second] = setup.http.sent

        expect(first?.url).toBe(
          "https://gitlab.com/api/v4/projects/team%2Fsub%2Fweb/pipelines",
        )
        expect(first?.params).toEqual({ per_page: "5", ref: "develop" })
        expect(second?.params).toEqual({ per_page: "20" })
        expect(first?.header("authorization")).toBe("Bearer glpat-secret")
      }),
    )
  })
})

describe("listJobs", () => {
  it.effect("maps jobs in pipeline order with their stage, no steps", () => {
    const setup = withGitLab(
      always({ status: 200, body: jobsPayload }),
      gitlab => gitlab.listJobs(run),
    )

    return setup.effect.pipe(
      Effect.map(jobs => {
        expect(setup.http.sent[0]?.url).toBe(
          "https://gitlab.com/api/v4/projects/team%2Fsub%2Fweb/pipelines/9001/jobs",
        )
        expect(
          jobs.map(job => [job.name, job.stage, job.status, job.steps.length]),
        ).toEqual([
          ["install", "build", "success", 0],
          ["test", "test", "failure", 0],
          ["deploy", "deploy", "skipped", 0],
        ])
        expect(jobs[1]?.finishedAt).toEqual(new Date("2026-11-26T19:00:58Z"))
      }),
    )
  })
})

describe("errors", () => {
  const failWith = (reply: FakeReply, glab: FakeBinary = LOGGED_IN) =>
    withGitLab(
      always(reply),
      gitlab => Effect.flip(gitlab.listRuns(repo, OPTS)),
      glab,
    )

  it.effect("401 → Unauthorized with the glab hint", () =>
    failWith({ status: 401 }).effect.pipe(
      Effect.map(
        failsWith(Unauthorized, {
          host: "gitlab.com",
          hint: "The token was rejected: run `glab auth login`.",
        }),
      ),
    ),
  )

  it.effect("403 → Unauthorized (missing scope)", () =>
    failWith({ status: 403 }).effect.pipe(
      Effect.map(failsWith(Unauthorized, { host: "gitlab.com" })),
    ),
  )

  it.effect("429 → RateLimited until RateLimit-Reset", () =>
    failWith({
      status: 429,
      headers: { "ratelimit-reset": "1800000000" },
    }).effect.pipe(
      Effect.map(
        failsWith(RateLimited, { resetAt: new Date(1_800_000_000_000) }),
      ),
    ),
  )

  it.effect("404 → NotFound for the repo", () =>
    failWith({ status: 404 }).effect.pipe(
      Effect.map(failsWith(NotFound, { resource: "repo" })),
    ),
  )

  it.effect("500 → Unexpected with the status", () =>
    failWith({ status: 500 }).effect.pipe(
      Effect.map(failsWith(Unexpected, { status: 500 })),
    ),
  )

  it.effect("glab printing nothing → AuthMissing (not-logged-in)", () =>
    failWith({ status: 200 }, { exitCode: 0, stdout: "\n" }).effect.pipe(
      Effect.map(
        failsWith(AuthMissing, {
          reason: "not-logged-in",
          hint: "Run `glab auth login`.",
        }),
      ),
    ),
  )

  it.effect("glab missing → AuthMissing (cli-not-installed)", () =>
    failWith({ status: 200 }, "missing").effect.pipe(
      Effect.map(failsWith(AuthMissing, { reason: "cli-not-installed" })),
    ),
  )
})

describe("matchRemote", () => {
  const cases: ReadonlyArray<readonly [string, string | undefined]> = [
    ["git@gitlab.com:team/web.git", "team/web"],
    ["https://gitlab.com/group/sub/project.git", "group/sub/project"],
    ["ssh://git@gitlab.com:22/a/b", "a/b"],
    ["git@github.com:a/b.git", undefined],
    ["git@git.company.io:infra/k8s.git", undefined],
  ]

  for (const [url, path] of cases)
    it.effect(`${url} → ${path ?? "none"}`, () =>
      Effect.sync(() =>
        expect(Option.getOrUndefined(GitLab.matchRemote(url))?.path).toBe(path),
      ),
    )
})

describe("glStatus", () => {
  const cases: ReadonlyArray<readonly [string, Status]> = [
    ["success", "success"],
    ["failed", "failure"],
    ["running", "running"],
    ["created", "queued"],
    ["pending", "queued"],
    ["waiting_for_resource", "queued"],
    ["scheduled", "queued"],
    ["canceled", "cancelled"],
    ["canceling", "cancelled"],
    ["skipped", "skipped"],
    ["manual", "idle"],
    ["something_new", "idle"],
  ]

  for (const [status, expected] of cases)
    it.effect(`${status} → ${expected}`, () =>
      Effect.sync(() => expect(glStatus(status)).toBe(expected)),
    )
})
