import { expect, spyOn, test } from "bun:test"

import { RateLimited } from "../../src/domain"
import { UnknownKey } from "../../src/platform"
import { entry, renderApp, stateOf } from "../support/app"
import { repo } from "../support/domain"

const twoRepos = stateOf({
  repos: [entry({ repo: repo("acme/api") }), entry({ repo: repo("acme/web") })],
})

test("shows the header, the repos and the keys", async () => {
  const app = await renderApp(twoRepos)

  expect(app.frame()).toContain("tuiaux v1.2.3")
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

test("? opens the help, esc closes it", async () => {
  const app = await renderApp(twoRepos)

  await app.press("?")
  expect(app.frame()).toContain("─ keys ─")

  await app.interact(() => app.setup.mockInput.pressEscape())
  expect(app.frame()).not.toContain("─ keys ─")
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

test("the key list draws each command once", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {})
  const app = await renderApp(twoRepos)

  await app.press("?")

  expect(app.frame().match(/Quit/g)?.length).toBe(1)
  expect(errors).not.toHaveBeenCalled()
  errors.mockRestore()
})
