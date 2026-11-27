import { expect, spyOn, test } from "bun:test"

import { entry, renderApp, stateOf } from "../support/app"
import { repo, run, runRef } from "../support/domain"

const API = repo("acme/api")
const WEB = repo("acme/web")

const state = stateOf({
  repos: [
    entry({ repo: API, current: true, runs: [run({ ref: runRef("1", API) })] }),
    entry({
      repo: WEB,
      runs: [run({ ref: runRef("2", WEB), workflow: "Deploy", number: 7 })],
    }),
  ],
})

const open = async () => {
  const app = await renderApp(state, { height: 40 })

  await app.interact(() => app.setup.mockInput.pressKey("k", { ctrl: true }))

  return app
}

test("ctrl+k opens the palette with actions, repos and runs", async () => {
  const app = await open()
  const frame = app.frame()

  expect(frame).toContain("─ Commands ─")
  expect(frame).toContain("ACTIONS")
  expect(frame).toContain("REPOS")
  expect(frame).toContain("RUNS")
})

test("typing filters; letters type instead of triggering keys", async () => {
  const app = await open()

  await app.press("r", "e", "f", "r")

  expect(app.frame()).toContain("Refresh now")
  expect(app.frame()).not.toContain("Quit")

  await app.press("q", "r")

  expect(app.quits()).toBe(0)
  expect(app.commands).not.toContain("refresh")
})

test("no match says so and enter does nothing", async () => {
  const app = await open()

  await app.press("z", "z", "z", "z")
  expect(app.frame()).toContain("No matches")

  await app.interact(() => app.setup.mockInput.pressEnter())
  expect(app.frame()).toContain("─ Commands ─")
})

test("enter on a repo selects it in the dashboard", async () => {
  const app = await open()

  await app.press("w", "e", "b")
  await app.interact(() => app.setup.mockInput.pressEnter())

  expect(app.frame()).not.toContain("─ Commands ─")
  expect(app.frame()).toContain("Runs · acme/web")
})

test("enter on a run opens its detail", async () => {
  const app = await open()

  await app.press("d", "e", "p", "#")
  await app.interact(() => app.setup.mockInput.pressEnter())

  expect(app.frame()).toContain("Deploy #7")
  expect(app.frame()).not.toContain("─ Repos ─")
})

test("? opens the same palette, About shows the version, esc closes", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {})
  const app = await renderApp(state)

  await app.press("?")
  expect(app.frame()).toContain("─ Commands ─")

  await app.press("a", "b", "o", "u", "t")
  await app.interact(() => app.setup.mockInput.pressEnter())
  expect(app.frame()).toContain("config: /home/me")

  await app.interact(() => app.setup.mockInput.pressEscape())
  expect(app.frame()).not.toContain("config: /home/me")
  expect(errors).not.toHaveBeenCalled()
  errors.mockRestore()
})
