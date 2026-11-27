import { describe, expect, test } from "bun:test"

import { JobId, JobRef, Step } from "../../src/domain"
import { defaultJob } from "../../src/features/run-detail/model"
import { entry, renderApp, stateOf } from "../support/app"
import { T0, job, repo, run, runRef } from "../support/domain"

const API = repo("acme/api")
const LAB = repo("team/web", "gitlab")
const RUN = runRef("87", API)

const jobRef = (id: string) => new JobRef({ run: RUN, id: JobId.make(id) })

const step = (name: string, status: "success" | "failure" | "skipped") =>
  new Step({
    name,
    status,
    startedAt: T0,
    finishedAt: new Date(T0.getTime() + 9_000),
  })

const jobs = [
  job({
    ref: jobRef("1"),
    name: "install",
    status: "success",
    url: "https://github.com/acme/api/job/1",
    steps: [step("bun install", "success")],
  }),
  job({
    ref: jobRef("2"),
    name: "test",
    status: "failure",
    url: "https://github.com/acme/api/job/2",
    steps: [step("Checkout", "success"), step("bun test", "failure")],
  }),
  job({
    ref: jobRef("3"),
    name: "deploy",
    status: "skipped",
    url: "https://github.com/acme/api/job/3",
    steps: [],
  }),
]

const ciRun = run({
  ref: RUN,
  number: 87,
  workflow: "CI",
  status: "failure",
  url: "https://github.com/acme/api/actions/runs/87",
})

const state = stateOf({
  repos: [
    entry({ repo: API, current: true, runs: [ciRun] }),
    entry({ repo: repo("acme/web") }),
  ],
  focusedRun: { run: RUN, jobs, error: undefined },
})

/** Opens the run detail of the first run from the dashboard. */
const openDetail = async (initial = state) => {
  const app = await renderApp(initial)

  await app.press("TAB", "RETURN")

  return app
}

describe("navigation", () => {
  test("⏎ on a run opens its detail, focusing that run", async () => {
    const app = await openDetail()

    expect(app.frame()).toContain("acme/api › CI #87")
    expect(app.frame()).toContain("Steps")
    expect(app.commands.at(-1)).toBe("focusRun 87")
  })

  test("esc goes back to the dashboard with the same selection", async () => {
    const app = await openDetail()

    await app.interact(() => app.setup.mockInput.pressEscape())

    expect(app.frame()).toContain("Runs · acme/api")
    expect(app.frame()).not.toContain("Steps ·")
  })
})

describe("jobs and steps", () => {
  test("starts on the failing job and shows its steps", async () => {
    const app = await openDetail()

    expect(app.frame()).toContain("Steps · test")
    expect(app.frame()).toContain("bun test")
    expect(app.frame()).toContain("1 failing step")
  })

  test("j moves to the next job; o opens it", async () => {
    const app = await openDetail()

    await app.press("j", "o")

    expect(app.frame()).toContain("Steps · deploy")
    expect(app.frame()).toContain("No steps reported for this job.")
    expect(app.opened).toEqual(["https://github.com/acme/api/job/3"])
  })

  test("a GitLab job shows its stage instead of steps", async () => {
    const labRun = runRef("9", LAB)

    const app = await openDetail(
      stateOf({
        repos: [entry({ repo: LAB, runs: [run({ ref: labRun })] })],
        focusedRun: {
          run: labRun,
          jobs: [
            job({
              ref: new JobRef({ run: labRun, id: JobId.make("7") }),
              name: "lint",
              stage: "test",
              steps: [],
            }),
          ],
          error: undefined,
        },
      }),
    )

    expect(app.frame()).toContain("test › lint")
    expect(app.frame()).toContain("Stage test. GitLab jobs have no steps.")
  })

  test("says so while the jobs are loading", async () => {
    const app = await openDetail(stateOf({ repos: state.repos }))

    expect(app.frame()).toContain("Loading jobs…")
  })

  test("a run that left the list leaves a way back", async () => {
    const app = await openDetail()

    await app.update(
      stateOf({ repos: [entry({ repo: API, current: true, runs: [] })] }),
    )

    expect(app.frame()).toContain("This run isn't in the recent list anymore")
  })
})

describe("defaultJob", () => {
  test("failing first, then running, then the first job", () => {
    expect(defaultJob(jobs)?.name).toBe("test")
    expect(
      defaultJob([job({ name: "a" }), job({ name: "b", status: "running" })])
        ?.name,
    ).toBe("b")
    expect(defaultJob([job({ name: "a" })])?.name).toBe("a")
    expect(defaultJob([])).toBeUndefined()
  })
})
