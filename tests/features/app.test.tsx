import { afterEach, expect, test } from "bun:test"
import { Effect, Stream, SubscriptionRef } from "effect"
import { Atom } from "effect/reactivity"
import { act } from "react"

import { testRender } from "@opentui/react/test-utils"

import { RateLimited } from "../../src/domain"
import { Root } from "../../src/features/app/app"
import {
  type Monitor,
  MonitorState,
  RepoEntry,
  RepoHealth,
} from "../../src/monitor"
import { UnknownKey } from "../../src/platform"
import { resolveTheme } from "../../src/ui"
import { repo, run } from "../support/domain"

type Setup = Awaited<ReturnType<typeof testRender>>

let current: Setup | undefined

// Destroying the renderer unmounts the React tree: do it inside act() too.
afterEach(() => {
  act(() => current?.renderer.destroy())
  current = undefined
})

const entry = (path: string, status: "success" | "failure") =>
  new RepoEntry({
    repo: repo(path),
    current: false,
    runs: [run({ status, branch: "main" })],
    fetchedAt: undefined,
    stale: false,
    health: RepoHealth.Ok(),
  })

const stateOf = (
  overrides: Partial<ConstructorParameters<typeof MonitorState>[0]> = {},
) =>
  new MonitorState({
    inGitRepo: true,
    repos: [entry("acme/api", "success"), entry("acme/web", "failure")],
    hostIssues: [],
    focusedRepo: undefined,
    focusedRun: undefined,
    ...overrides,
  })

/** Renders the app over a fixed state; records the Monitor commands and quits it receives. */
const renderApp = async (
  state: MonitorState,
  configIssues: ReadonlyArray<UnknownKey> = [],
) => {
  const commands: Array<string> = []
  let quits = 0
  const ref = Effect.runSync(SubscriptionRef.make(state))

  const monitor: Monitor["Service"] = {
    state: ref,
    settled: Stream.empty,
    focusRepo: () => Effect.void,
    focusRun: () => Effect.void,
    refresh: Effect.sync(() => void commands.push("refresh")),
    forget: () => Effect.void,
  }

  current = await testRender(
    <Root
      theme={resolveTheme("tuiaux-dark", {}, undefined)}
      app={{
        version: "1.2.3",
        state: Atom.subscriptionRef(ref),
        configPath: "/home/me/.config/tuiaux/config.toml",
        configIssues,
        run: command => Effect.runSync(command(monitor)),
        quit: () => void quits++,
      }}
    />,
    { width: 90, height: 16, kittyKeyboard: true },
  )
  const setup = current

  /** Runs an interaction inside act() and renders, so React applies every update before asserting. */
  const interact = (action: () => void = () => {}) =>
    act(async () => {
      action()
      await setup.renderOnce()
    })

  await interact()

  return { setup, interact, commands, quits: () => quits }
}

test("shows the header, the repos and the global keys", async () => {
  const { setup } = await renderApp(stateOf())
  const frame = setup.captureCharFrame()

  expect(frame).toContain("tuiaux v1.2.3")
  expect(frame).toContain("acme/api")
  expect(frame).toContain("acme/web")
  expect(frame).toContain("r refresh")
})

test("a host issue replaces the key hints", async () => {
  const issue = new RateLimited({
    kind: "github",
    host: "github.com",
    resetAt: new Date(2026, 10, 27, 14, 30),
  })

  const { setup } = await renderApp(stateOf({ hostIssues: [issue] }))

  expect(setup.captureCharFrame()).toContain(
    "github.com rate limit reached, back at 14:30",
  )
})

test("outside a git repo with nothing remembered, says so", async () => {
  const { setup } = await renderApp(stateOf({ inGitRepo: false, repos: [] }))

  expect(setup.captureCharFrame()).toContain(
    "You are currently not in a Git repo",
  )
})

test("r refreshes and q quits", async () => {
  const { setup, interact, commands, quits } = await renderApp(stateOf())

  await interact(() => {
    setup.mockInput.pressKey("r")
    setup.mockInput.pressKey("q")
  })

  expect(commands).toEqual(["refresh"])
  expect(quits()).toBe(1)
})

test("config issues open a dialog that esc closes, keys wait meanwhile", async () => {
  const { setup, interact, commands } = await renderApp(stateOf(), [
    new UnknownKey({ key: "repos" }),
  ])

  expect(setup.captureCharFrame()).toContain("repos: unknown setting, ignored")

  await interact(() => {
    setup.mockInput.pressKey("r")
    setup.mockInput.pressEscape()
  })

  expect(commands).toEqual([])
  expect(setup.captureCharFrame()).not.toContain("unknown setting")
})
