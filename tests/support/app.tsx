/** Renders the real app over a fixed Monitor state and records what the UI asked for. */
import { afterEach } from "bun:test"
import { Effect, Stream, SubscriptionRef } from "effect"
import { Atom } from "effect/reactivity"
import { act } from "react"

import { testRender } from "@opentui/react/test-utils"

import { Root } from "../../src/features/app/app"
import {
  type Monitor,
  MonitorState,
  RepoEntry,
  RepoHealth,
} from "../../src/monitor"
import type { ConfigIssue } from "../../src/platform"
import { resolveTheme } from "../../src/ui"
import { repo, run } from "./domain"

type Setup = Awaited<ReturnType<typeof testRender>>

let mounted: Setup | undefined

// Destroying the renderer unmounts the React tree: do it inside act() too.
afterEach(() => {
  act(() => mounted?.renderer.destroy())
  mounted = undefined
})

export const entry = (
  overrides: Partial<ConstructorParameters<typeof RepoEntry>[0]> = {},
) =>
  new RepoEntry({
    repo: repo(),
    current: false,
    runs: [run()],
    fetchedAt: undefined,
    stale: false,
    health: RepoHealth.Ok(),
    ...overrides,
  })

export const stateOf = (
  overrides: Partial<ConstructorParameters<typeof MonitorState>[0]> = {},
) =>
  new MonitorState({
    inGitRepo: true,
    repos: [],
    hostIssues: [],
    focusedRepo: undefined,
    focusedRun: undefined,
    ...overrides,
  })

export const renderApp = async (
  state: MonitorState,
  options: {
    readonly configIssues?: ReadonlyArray<ConfigIssue>
    readonly width?: number
    readonly height?: number
  } = {},
) => {
  const commands: Array<string> = []
  const opened: Array<string> = []
  let quits = 0
  const ref = Effect.runSync(SubscriptionRef.make(state))

  const record = (command: string) =>
    Effect.sync(() => void commands.push(command))

  const monitor: Monitor["Service"] = {
    state: ref,
    settled: Stream.empty,
    focusRepo: target => record(`focusRepo ${target?.path ?? "-"}`),
    focusRun: target => record(`focusRun ${target?.id ?? "-"}`),
    refresh: record("refresh"),
    forget: target => record(`forget ${target.path}`),
  }

  const setup = await testRender(
    <Root
      theme={resolveTheme("tuiaux-dark", {}, undefined)}
      app={{
        version: "1.2.3",
        state: Atom.subscriptionRef(ref),
        configPath: "/home/me/.config/tuiaux/config.toml",
        configIssues: options.configIssues ?? [],
        run: command => Effect.runSync(command(monitor)),
        open: url => void opened.push(url),
        quit: () => void quits++,
      }}
    />,
    {
      width: options.width ?? 120,
      height: options.height ?? 24,
      kittyKeyboard: true,
    },
  )

  mounted = setup

  /** Runs an interaction inside act() and renders, so React applies every update before asserting. */
  const interact = (action: () => void = () => {}) =>
    act(async () => {
      action()
      await setup.renderOnce()
    })

  /** Presses keys one by one, each as its own interaction. */
  const press = async (...keys: ReadonlyArray<string>) => {
    for (const key of keys) await interact(() => setup.mockInput.pressKey(key))
  }

  await interact()

  return {
    frame: () => setup.captureCharFrame(),
    interact,
    press,
    setup,
    commands,
    opened,
    quits: () => quits,
    /** Replaces the Monitor state, as a poll would. */
    update: (next: MonitorState) =>
      interact(() => Effect.runSync(SubscriptionRef.set(ref, next))),
  }
}
