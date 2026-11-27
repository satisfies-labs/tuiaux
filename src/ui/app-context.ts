import type { Effect } from "effect"
import type { Atom } from "effect/reactivity"
import { createContext, useContext } from "react"

import { useAtomValue } from "@effect/atom-react"

import type { Monitor, MonitorState } from "../monitor"
import type { ConfigIssue } from "../platform"

/** What the UI may use of the running app: Monitor state and commands, never providers or HTTP. */
export interface AppHandle {
  readonly version: string
  readonly state: Atom.Atom<MonitorState>
  readonly configPath: string
  readonly configIssues: ReadonlyArray<ConfigIssue>
  /** Runs a Monitor command in the app's runtime (file logger, app scope). */
  readonly run: (
    command: (monitor: Monitor["Service"]) => Effect.Effect<void>,
  ) => void
  readonly quit: () => void
}

export const AppContext = createContext<AppHandle | undefined>(undefined)

export const useApp = (): AppHandle => {
  const app = useContext(AppContext)

  // A component rendered outside <AppContext> is a bug, not a state to handle.
  if (app === undefined)
    throw new Error("useApp() needs an <AppContext> above it")

  return app
}

export const useMonitorState = (): MonitorState => useAtomValue(useApp().state)
