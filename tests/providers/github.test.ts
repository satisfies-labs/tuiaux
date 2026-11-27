import { describe, expect } from "bun:test"
import { Effect, Option } from "effect"

import {
  AuthMissing,
  Network,
  NotFound,
  RateLimited,
  RepoRef,
  RunId,
  RunRef,
  type Status,
  Unauthorized,
  Unexpected,
} from "../../src/domain"
import { GitHub } from "../../src/providers/github"
import { ghStatus } from "../../src/providers/github/map"
import type { Provider } from "../../src/providers/provider"
import type { FakeReply, SentRequest } from "../fakes/http-client"
import type { FakeBinary } from "../fakes/spawner"
import jobsPayload from "../fixtures/github/jobs.json"
import runsPayload from "../fixtures/github/runs.json"
import { it } from "../support/effect"
import { always, failsWith, withProvider } from "../support/providers"

const repo = new RepoRef({
  kind: "github",
  host: "github.com",
  path: "satisfies-labs/tuiaux",
})

const run = new RunRef({ repo, id: RunId.make("1001") })

const LOGGED_IN: FakeBinary = { exitCode: 0, stdout: "gho_secret\n" }

const OPTS = { branch: undefined, limit: 20 }

const withGitHub = <A, E>(
  route: (request: SentRequest) => FakeReply,
  use: (provider: Provider) => Effect.Effect<A, E>,
  gh: FakeBinary = LOGGED_IN,
) => withProvider(GitHub, "gh", route, use, gh)

describe("listRuns", () => {
  it.effect(
    "maps runs, newest first",
    () =>
      withGitHub(always({ status: 200, body: runsPayload }), github =>
        Effect.gen(function* () {
          const [running, timedOut] = yield* github.listRuns(repo, OPTS)

          expect(running).toMatchObject({
            workflow: "CI",
            number: 412,
            status: "running",
            branch: "main",
            commitMessage: "feat: pixel cloud hero",
            event: "push",
            actor: "Satisfies Labs",
            startedAt: new Date("2026-11-26T20:00:05Z"),
            finishedAt: undefined,
            url: "https://github.com/satisfies-labs/tuiaux/actions/runs/1001",
          })
          expect(running?.ref.id).toBe(RunId.make("1001"))
          expect(timedOut).toMatchObject({
            status: "failure",
            commitMessage: "wip: works grid",
            finishedAt: new Date("2026-11-26T18:00:50Z"),
          })
        }),
      ).effect,
  )

  it.effect("asks for the repo's runs with the token, limit and branch", () => {
    const setup = withGitHub(
      always({ status: 200, body: runsPayload }),
      github =>
        Effect.gen(function* () {
          yield* github.listRuns(repo, { branch: "feat/x", limit: 5 })
          yield* github.listRuns(repo, OPTS)
        }),
    )

    return setup.effect.pipe(
      Effect.map(() => {
        const [first, second] = setup.http.sent

        expect(first?.url).toBe(
          "https://api.github.com/repos/satisfies-labs/tuiaux/actions/runs",
        )
        expect(first?.params).toEqual({ per_page: "5", branch: "feat/x" })
        expect(second?.params).toEqual({ per_page: "20" })
        expect(first?.header("authorization")).toBe("Bearer gho_secret")
        expect(first?.header("x-github-api-version")).toBe("2022-11-28")
      }),
    )
  })
})

describe("listJobs", () => {
  it.effect("maps jobs with ordered steps and progress", () => {
    const setup = withGitHub(
      always({ status: 200, body: jobsPayload }),
      github => github.listJobs(run),
    )

    return setup.effect.pipe(
      Effect.map(([job]) => {
        expect(setup.http.sent[0]?.url).toBe(
          "https://api.github.com/repos/satisfies-labs/tuiaux/actions/runs/1001/jobs",
        )
        expect(job).toMatchObject({
          name: "test",
          stage: undefined,
          status: "running",
          progress: 0.5,
          finishedAt: undefined,
        })
        expect(job?.steps.map(step => [step.name, step.status])).toEqual([
          ["Checkout", "success"],
          ["bun test", "running"],
        ])
      }),
    )
  })
})

describe("errors", () => {
  const failWith = (reply: FakeReply, gh: FakeBinary = LOGGED_IN) =>
    withGitHub(
      always(reply),
      github => Effect.flip(github.listRuns(repo, OPTS)),
      gh,
    )

  it.effect("401 → Unauthorized, and the token is read again next time", () => {
    const setup = withGitHub(always({ status: 401 }), github =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(github.listRuns(repo, OPTS))

        yield* Effect.flip(github.listRuns(repo, OPTS))

        return error
      }),
    )

    return setup.effect.pipe(
      Effect.map(error => {
        expect(error).toBeInstanceOf(Unauthorized)
        expect(setup.spawner.calls).toEqual([
          "gh auth token --hostname github.com",
          "gh auth token --hostname github.com",
        ])
      }),
    )
  })

  it.effect("concurrent calls share one token lookup", () => {
    const setup = withGitHub(
      always({ status: 200, body: runsPayload }),
      github =>
        Effect.all(
          Array.from({ length: 5 }, () => github.listRuns(repo, OPTS)),
          { concurrency: "unbounded" },
        ),
    )

    return setup.effect.pipe(
      Effect.map(() => expect(setup.spawner.calls).toHaveLength(1)),
    )
  })

  it.effect("the token is read once while it works", () => {
    const setup = withGitHub(
      always({ status: 200, body: runsPayload }),
      github =>
        Effect.all([github.listRuns(repo, OPTS), github.listJobs(run)]).pipe(
          Effect.ignore,
        ),
    )

    return setup.effect.pipe(
      Effect.map(() => expect(setup.spawner.calls).toHaveLength(1)),
    )
  })

  it.effect("403 with a spent quota → RateLimited until the reset header", () =>
    failWith({
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1800000000",
      },
    }).effect.pipe(
      Effect.map(
        failsWith(RateLimited, {
          host: "github.com",
          resetAt: new Date(1_800_000_000_000),
        }),
      ),
    ),
  )

  it.effect(
    "429 with retry-after → RateLimited that many seconds from now",
    () =>
      failWith({ status: 429, headers: { "retry-after": "30" } }).effect.pipe(
        Effect.map(failsWith(RateLimited, { resetAt: new Date(30_000) })),
      ),
  )

  it.effect("403 without rate-limit headers → Unauthorized", () =>
    failWith({ status: 403 }).effect.pipe(
      Effect.map(failsWith(Unauthorized, { host: "github.com" })),
    ),
  )

  it.effect("404 → NotFound for the repo", () =>
    failWith({ status: 404 }).effect.pipe(
      Effect.map(failsWith(NotFound, { resource: "repo" })),
    ),
  )

  it.effect("5xx → Unexpected with the status", () =>
    failWith({ status: 503 }).effect.pipe(
      Effect.map(failsWith(Unexpected, { status: 503 })),
    ),
  )

  it.effect("a payload that doesn't match → Unexpected without status", () =>
    failWith({
      status: 200,
      body: { workflow_runs: [{ id: "x" }] },
    }).effect.pipe(Effect.map(failsWith(Unexpected, { status: undefined }))),
  )

  it.effect("no answer → Network", () =>
    failWith("unreachable").effect.pipe(
      Effect.map(failsWith(Network, { host: "github.com" })),
    ),
  )

  it.effect(
    "gh missing → AuthMissing (cli-not-installed), no request sent",
    () => {
      const setup = failWith({ status: 200, body: runsPayload }, "missing")

      return setup.effect.pipe(
        Effect.map(error => {
          failsWith(AuthMissing, { reason: "cli-not-installed" })(error)
          expect(setup.http.sent).toHaveLength(0)
        }),
      )
    },
  )

  it.effect(
    "gh logged out → AuthMissing (not-logged-in) with the login hint",
    () =>
      failWith({ status: 200 }, { exitCode: 1, stdout: "" }).effect.pipe(
        Effect.map(
          failsWith(AuthMissing, {
            reason: "not-logged-in",
            hint: "Run `gh auth login`.",
          }),
        ),
      ),
  )
})

describe("matchRemote", () => {
  const cases: ReadonlyArray<readonly [string, string | undefined]> = [
    ["git@github.com:satisfies-labs/tuiaux.git", "satisfies-labs/tuiaux"],
    ["https://github.com/satisfies-labs/tuiaux", "satisfies-labs/tuiaux"],
    ["https://x-token:abc@github.com/a/b.git", "a/b"],
    ["git@gitlab.com:team/web.git", undefined],
    ["https://github.com/a/b/c", undefined],
    ["/home/me/repo", undefined],
  ]

  for (const [url, path] of cases)
    it.effect(`${url} → ${path ?? "none"}`, () =>
      Effect.sync(() =>
        expect(Option.getOrUndefined(GitHub.matchRemote(url))?.path).toBe(path),
      ),
    )
})

describe("ghStatus", () => {
  const cases: ReadonlyArray<readonly [string | null, string | null, Status]> =
    [
      ["queued", null, "queued"],
      ["waiting", null, "queued"],
      ["in_progress", null, "running"],
      ["completed", "success", "success"],
      ["completed", "neutral", "success"],
      ["completed", "failure", "failure"],
      ["completed", "timed_out", "failure"],
      ["completed", "startup_failure", "failure"],
      ["completed", "cancelled", "cancelled"],
      ["completed", "skipped", "skipped"],
      ["completed", "something_new", "idle"],
    ]

  for (const [status, conclusion, expected] of cases)
    it.effect(`${status}/${conclusion} → ${expected}`, () =>
      Effect.sync(() => expect(ghStatus(status, conclusion)).toBe(expected)),
    )
})
