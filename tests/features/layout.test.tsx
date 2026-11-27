import { describe, expect, test } from "bun:test"

import { JobId, JobRef, NotFound } from "../../src/domain"
import { RepoHealth } from "../../src/monitor"
import { entry, renderApp, stateOf } from "../support/app"
import { T0, job, repo, run, runRef } from "../support/domain"

const API = repo("satisfies-labs/portfolio-2026")
const WEB = repo("satisfies-labs/tuiaux")
const ref = runRef("12", API)

// Running time counts from the real clock: start 95 s ago to read `1:3x`.
const startedAt = new Date(Date.now() - 95_000)

const state = stateOf({
  repos: [
    entry({
      repo: API,
      current: true,
      runs: [
        run({
          ref,
          number: 412,
          status: "running",
          commitMessage: "feat: pixel cloud hero",
          createdAt: startedAt,
          startedAt,
        }),
        run({ ref: runRef("11", API), workflow: "Deploy", status: "failure" }),
      ],
    }),
    entry({ repo: WEB, runs: [run({ ref: runRef("5", WEB) })] }),
    entry({
      repo: repo("satisfies-labs/dotfiles"),
      health: RepoHealth.Failing({
        error: new NotFound({ repo: WEB, resource: "repo" }),
        since: T0,
        nextRetryAt: undefined,
      }),
    }),
  ],
  focusedRun: {
    run: ref,
    jobs: [job({ ref: new JobRef({ run: ref, id: JobId.make("1") }) })],
    error: undefined,
  },
})

describe.each([
  [120, 30],
  [80, 24],
  [60, 20],
])("dashboard at %i × %i", (width, height) => {
  test("no row overflows, the running time and repo names stay whole", async () => {
    const app = await renderApp(state, { width, height })
    const frame = app.frame()

    for (const line of frame.split("\n"))
      expect(line.length).toBeLessThanOrEqual(width)

    expect(frame).toMatch(/1:3\d/)
    expect(frame).toContain("portfolio-2026")
    expect(frame).toContain("^K commands")
  })
})

test("zero counts stay out of the summary", async () => {
  const app = await renderApp(state)

  expect(app.frame()).not.toContain("0 failed")
  expect(app.frame()).toContain("1 running")
})

test("a failing repo shows ! and its error, even at 80 columns", async () => {
  const app = await renderApp(state, { width: 80, height: 24 })

  const row = app
    .frame()
    .split("\n")
    .find(line => line.includes("dotfiles"))

  expect(row).toContain("!")
  expect(row).toContain("repo not")
})

test("repos sharing one owner show their name only", async () => {
  const app = await renderApp(state)

  expect(app.frame()).not.toContain("satisfies-labs/tuiaux ")
  expect(app.frame()).toContain(" tuiaux ")
})
