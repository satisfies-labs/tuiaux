import { expect, test } from "bun:test"

import { entry, renderApp, stateOf } from "../support/app"
import { repo, run, runRef } from "../support/domain"

const API = repo("acme/api")
const WEB = repo("acme/web")

const state = stateOf({
  repos: [
    entry({ repo: API, current: true, runs: [run({ ref: runRef("1", API) })] }),
    entry({
      repo: WEB,
      runs: [run({ ref: runRef("2", WEB), status: "failure" })],
    }),
  ],
})

test("/ filters the repos by name; esc clears it", async () => {
  const app = await renderApp(state)

  await app.press("/")
  expect(app.frame()).toContain("─ filter repos ─")

  await app.press("w", "e", "b")
  await app.interact(() => app.setup.mockInput.pressEnter())

  expect(app.frame()).toContain('filter: "web"')
  expect(app.frame()).toContain("Runs · acme/web")
  expect(app.frame()).not.toMatch(/│ [ ▌]● api /)

  await app.interact(() => app.setup.mockInput.pressEscape())
  expect(app.frame()).not.toContain("filter:")
  expect(app.frame()).toMatch(/[ ▌]● api /)
})

test("f keeps only failing repos", async () => {
  const app = await renderApp(state)

  await app.press("f")

  expect(app.frame()).toContain("filter: failing")
  expect(app.frame()).not.toMatch(/[ ▌]● api /)
  expect(app.frame()).toMatch(/[ ▌]● web /)
})

test("a filter matching nothing says how to clear it", async () => {
  const app = await renderApp(state)

  await app.press("/", "z", "z", "z")
  await app.interact(() => app.setup.mockInput.pressEnter())

  expect(app.frame()).toContain('No repo matches "zzz".')
  expect(app.frame()).toContain("esc clears the filter.")
})

test("o confirms in the status line", async () => {
  const app = await renderApp(state)

  await app.press("o")

  expect(app.opened).toEqual(["https://github.com/acme/api"])
  expect(app.frame()).toContain("opened in browser")
})
