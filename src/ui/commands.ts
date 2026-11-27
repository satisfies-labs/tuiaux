import { createContext } from "react"

import type { ParsedKey } from "@opentui/core"

import type { Status } from "../domain"

/** Sections of the command palette. */
export type CommandGroup = "Actions" | "Repos" | "Runs"

/** One thing the user can do: its keys, its status-line hint and its palette entry all come from here. */
export interface Command {
  readonly id: string
  readonly title: string
  readonly group: CommandGroup
  /** Key names or sequences: `j`, `down`, `return`, `?`, `ctrl+k`. */
  readonly keys: ReadonlyArray<string>
  /** Short label in the status line, in array order; none keeps it out of the line. */
  readonly hint?: string | undefined
  /** What the hint shows as the key, when not the first binding (e.g. `↑↓`). */
  readonly hintKey?: string | undefined
  /** Listed in the palette unless false. */
  readonly palette?: boolean | undefined
  /** Right column in the palette, e.g. `main · 12m`. */
  readonly detail?: string | undefined
  /** Dot shown before repos and runs in the palette. */
  readonly status?: Status | undefined
  readonly run: () => void
}

type Key = Pick<ParsedKey, "name" | "sequence" | "ctrl">

const matches = (binding: string, key: Key): boolean =>
  binding.startsWith("ctrl+")
    ? key.ctrl && key.name === binding.slice(5)
    : !key.ctrl && (key.name === binding || key.sequence === binding)

/** The command a key press triggers: the first one bound to it. */
export const matchKey = (
  commands: ReadonlyArray<Command>,
  key: Key,
): Command | undefined =>
  commands.find(command => command.keys.some(binding => matches(binding, key)))

const LABELS = {
  return: "⏎",
  escape: "esc",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  backspace: "⌫",
} satisfies Readonly<Record<string, string>>

const isLabelled = (binding: string): binding is keyof typeof LABELS =>
  Object.hasOwn(LABELS, binding)

/** How a key binding reads on screen: `⏎`, `esc`, `^K`. */
export const keyLabel = (binding: string): string =>
  binding.startsWith("ctrl+")
    ? `^${binding.slice(5).toUpperCase()}`
    : isLabelled(binding)
      ? LABELS[binding]
      : binding

/** The app-wide commands, merged after each view's own. */
export const GlobalCommandsContext = createContext<ReadonlyArray<Command>>([])
