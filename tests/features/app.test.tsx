import { expect, test } from "bun:test"

import { RateLimited } from "../../src/domain"
import { UnknownKey } from "../../src/platform"
import { entry, renderApp, stateOf } from "../support/app"
import { repo, run, runRef } from "../support/domain"

const twoRepos = stateOf({
  repos: [entry({ repo: repo("acme/api") }), entry({ repo: repo("acme/web") })],
})

test("shows the header, the repos and the keys", async () => {
  const app = await renderApp(twoRepos)

  expect(app.frame()).toContain("1 Dashboard")
  expect(app.frame()).not.toContain("v1.2.3")
  expect(app.frame()).toContain("acme/api")
  expect(app.frame()).toContain("r refresh")
})

test("a host issue replaces the key hints", async () => {
  const issue = new RateLimited({
    kind: "github",
    host: "github.com",
    resetAt: new Date(2026, 10, 27, 14, 30),
  })

  const app = await renderApp(
    stateOf({ repos: twoRepos.repos, hostIssues: [issue] }),
  )

  expect(app.frame()).toContain("github.com rate limit reached, back at 14:30")
})

test("outside a git repo with nothing remembered, says so", async () => {
  const app = await renderApp(stateOf({ inGitRepo: false }))

  expect(app.frame()).toContain("You are currently not in a Git repo")
})

test("r refreshes and q quits", async () => {
  const app = await renderApp(twoRepos)

  await app.press("r", "q")

  expect(app.commands).toContain("refresh")
  expect(app.quits()).toBe(1)
})

test("config issues open first; keys wait until esc closes them", async () => {
  const app = await renderApp(twoRepos, {
    configIssues: [new UnknownKey({ key: "repos" })],
  })

  expect(app.frame()).toContain("repos: unknown setting, ignored")

  await app.press("r")
  await app.interact(() => app.setup.mockInput.pressEscape())

  expect(app.commands).not.toContain("refresh")
  expect(app.frame()).not.toContain("unknown setting")
})

test("at 80 columns the hints fit and the commands key stays visible", async () => {
  const app = await renderApp(twoRepos, { width: 80, height: 24 })
  const frame = app.frame()

  expect(frame).toContain("^K commands")

  for (const line of frame.split("\n"))
    expect(line.length).toBeLessThanOrEqual(80)
})

const API = repo("acme/api")

const withRun = stateOf({
  repos: [entry({ repo: API, runs: [run({ ref: runRef("12", API) })] })],
})

test("2 and 3 do nothing before a run was opened", async () => {
  const app = await renderApp(withRun)

  await app.press("2", "3")

  expect(app.frame()).toContain("─ Repos ─")
})

test("esc from watch goes back to the run detail it came from", async () => {
  const app = await renderApp(withRun)

  await app.interact(() => app.setup.mockInput.pressEnter())
  await app.press("w")
  expect(app.frame()).toContain("─ watch ─")

  await app.interact(() => app.setup.mockInput.pressEscape())
  expect(app.frame()).toContain("─ Jobs ─")
  expect(app.frame()).not.toContain("─ Repos ─")

  await app.press("1")
  expect(app.frame()).toContain("─ Repos ─")

  await app.press("3")
  expect(app.frame()).toContain("─ watch ─")
})

test("esc from a run that left the list goes back to the dashboard", async () => {
  const app = await renderApp(withRun)

  await app.interact(() => app.setup.mockInput.pressEnter())
  await app.update(stateOf({ repos: [entry({ repo: API, runs: [] })] }))
  expect(app.frame()).toContain("isn't in the recent list anymore")

  await app.interact(() => app.setup.mockInput.pressEscape())
  expect(app.frame()).toContain("─ Repos ─")
})
