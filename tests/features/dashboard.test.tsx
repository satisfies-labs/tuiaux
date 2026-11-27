import { describe, expect, test } from "bun:test"

import { NotFound } from "../../src/domain"
import { JobId, JobRef } from "../../src/domain"
import { RepoHealth } from "../../src/monitor"
import { entry, renderApp, stateOf } from "../support/app"
import { T0, job, repo, run, runRef } from "../support/domain"

const jobRef = (id: string) =>
  new JobRef({ run: runRef("12", repo("acme/api")), id: JobId.make(id) })

const API = repo("acme/api")
const WEB = repo("acme/web")
const UI = repo("team/ui", "gitlab")

const apiRuns = [
  run({
    ref: runRef("12", API),
    number: 12,
    workflow: "CI",
    status: "running",
    commitMessage: "feat: pixel cloud",
    url: "https://github.com/acme/api/actions/runs/12",
    createdAt: T0,
    startedAt: T0,
  }),
  run({
    ref: runRef("11", API),
    number: 11,
    workflow: "Deploy",
    status: "failure",
    commitMessage: "fix: og image",
    url: "https://github.com/acme/api/actions/runs/11",
  }),
]

const state = stateOf({
  repos: [
    entry({ repo: API, current: true, runs: apiRuns }),
    entry({
      repo: WEB,
      runs: [run({ ref: runRef("5", WEB), workflow: "Lint" })],
    }),
    entry({ repo: UI, runs: [] }),
  ],
})

describe("layout", () => {
  test("repos grouped by provider, runs of the selection, summary", async () => {
    const app = await renderApp(state)
    const frame = app.frame()

    expect(frame).toContain("GITHUB")
    expect(frame).toContain("GITLAB")
    expect(frame).toContain("Runs · acme/api")
    expect(frame).toContain("feat: pixel cloud")
    expect(frame).toContain("fix: og image")
    expect(frame).toContain("3 repos")
    expect(frame).toContain("1 running")
  })

  test("a failing repo shows its error on its row", async () => {
    const failing = RepoHealth.Failing({
      error: new NotFound({ repo: WEB, resource: "repo" }),
      since: T0,
      nextRetryAt: undefined,
    })

    const app = await renderApp(
      stateOf({ repos: [entry({ repo: WEB, health: failing })] }),
    )

    expect(app.frame()).toContain("repo not found")
  })
})

test("a repo without runs says where its CI configuration lives", async () => {
  const app = await renderApp(
    stateOf({ repos: [entry({ repo: UI, current: true, runs: [] })] }),
  )

  expect(app.frame()).toContain(
    "GitLab CI runs the pipeline defined in .gitlab-ci.yml",
  )
})

describe("navigation", () => {
  test("focuses the selected repo and run in the Monitor", async () => {
    const app = await renderApp(state)

    expect(app.commands).toContain("focusRepo acme/api")
    expect(app.commands).toContain("focusRun 12")

    await app.press("j")

    expect(app.frame()).toContain("Runs · acme/web")
    expect(app.commands.at(-2)).toBe("focusRepo acme/web")
    expect(app.commands.at(-1)).toBe("focusRun 5")
  })

  test("tab moves to the runs; j selects the next run", async () => {
    const app = await renderApp(state)

    await app.press("TAB", "j")

    expect(app.commands.at(-1)).toBe("focusRun 11")
  })

  test("the selection follows the repo when the list reorders", async () => {
    const app = await renderApp(state)

    await app.press("j")
    await app.update(stateOf({ repos: [...state.repos].reverse() }))

    expect(app.frame()).toContain("Runs · acme/web")
  })
})

describe("actions", () => {
  test("o opens the repo, or the run when the runs panel has focus", async () => {
    const app = await renderApp(state)

    await app.press("o", "TAB", "o")

    expect(app.opened).toEqual([
      "https://github.com/acme/api",
      "https://github.com/acme/api/actions/runs/12",
    ])
  })

  test("d asks before forgetting a remembered repo", async () => {
    const app = await renderApp(state)

    await app.press("j", "d")
    expect(app.frame()).toContain("Forget acme/web?")

    await app.press("y")
    expect(app.commands).toContain("forget acme/web")
    expect(app.frame()).not.toContain("Forget acme/web?")
  })

  test("n keeps the repo, and the current repo can't be forgotten", async () => {
    const app = await renderApp(state)

    await app.press("d")
    expect(app.frame()).not.toContain("Forget acme/api?")

    await app.press("j", "d", "n")
    expect(app.commands.some(command => command.startsWith("forget"))).toBe(
      false,
    )
  })
})

describe("jobs", () => {
  test("shows the jobs once the Monitor has them for the selected run", async () => {
    const app = await renderApp(state)

    expect(app.frame()).toContain("Loading jobs…")

    await app.update(
      stateOf({
        repos: state.repos,
        focusedRun: {
          run: runRef("12", API),
          jobs: [
            job({ ref: jobRef("1"), name: "lint", status: "success" }),
            job({ ref: jobRef("2"), name: "test", status: "running" }),
          ],
          error: undefined,
        },
      }),
    )

    expect(app.frame()).toContain("Jobs · CI #12")
    expect(app.frame()).toContain("lint")
    expect(app.frame()).toContain("████")
  })
})
