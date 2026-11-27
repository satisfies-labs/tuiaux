import { expect, test } from "bun:test"

import { JobId, JobRef } from "../../src/domain"
import { entry, renderApp, stateOf } from "../support/app"
import { job, repo, run, runRef } from "../support/domain"

const API = repo("satisfies-labs/portfolio-2026")
const RUN = runRef("412", API)
const jobRef = (id: string) => new JobRef({ run: RUN, id: JobId.make(id) })

const state = stateOf({
  repos: [
    entry({
      repo: API,
      current: true,
      runs: [
        run({
          ref: RUN,
          number: 412,
          workflow: "CI",
          status: "running",
          url: "https://github.com/x/actions/runs/412",
        }),
      ],
    }),
  ],
  focusedRun: {
    run: RUN,
    jobs: [
      job({ ref: jobRef("1"), name: "install", status: "success" }),
      job({ ref: jobRef("2"), name: "test", status: "running", progress: 0.5 }),
      job({ ref: jobRef("3"), name: "e2e", status: "queued" }),
      job({ ref: jobRef("4"), name: "lint", status: "success" }),
    ],
    error: undefined,
  },
})

test("w opens the watch view: run, overall progress, a dot per job", async () => {
  const app = await renderApp(state)

  await app.press("w")
  const frame = app.frame()

  expect(frame).toContain("watch")
  expect(frame).toContain("portfolio-2026 · CI #412 · main")
  expect(frame).toContain("63%")
  expect(frame).toContain("● install")
  expect(frame).toMatch(/[◐◓◑◒] test/)
  expect(frame).toContain("○ e2e")
  expect(app.commands.at(-1)).toBe("focusRun 412")
})

test("o opens the run, esc goes back to the dashboard", async () => {
  const app = await renderApp(state)

  await app.press("w", "o")
  expect(app.opened).toEqual(["https://github.com/x/actions/runs/412"])

  await app.interact(() => app.setup.mockInput.pressEscape())
  expect(app.frame()).toContain("Runs · satisfies-labs/portfolio-2026")
})

test("w from the run detail watches that run", async () => {
  const app = await renderApp(state)

  await app.press("TAB", "RETURN", "w")

  expect(app.frame()).toContain("portfolio-2026 · CI #412 · main")
})
