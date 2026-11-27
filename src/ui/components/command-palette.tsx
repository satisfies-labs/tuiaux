import { useState } from "react"

import { useKeyboard, useTerminalDimensions } from "@opentui/react"

import { type Command, type CommandGroup, keyLabel } from "../commands"
import { fuzzyScore } from "../fuzzy"
import { useText } from "../text"
import { useTheme } from "../theme"
import { visibleWindow } from "../window"
import { Dialog } from "./dialog"
import { StatusDot } from "./status-dot"

const GROUPS: ReadonlyArray<CommandGroup> = ["Actions", "Repos", "Runs"]

const KEY = 6

type Row =
  | { readonly kind: "header"; readonly group: CommandGroup }
  | { readonly kind: "item"; readonly command: Command; readonly index: number }

/** The commands matching `query`, best first (registry order on ties and for an empty query), by group. */
export const paletteItems = (
  commands: ReadonlyArray<Command>,
  query: string,
): ReadonlyArray<Command> => {
  const scored = commands.flatMap(command => {
    const score =
      command.palette === false ? undefined : fuzzyScore(query, command.title)

    return score === undefined ? [] : [{ command, score }]
  })

  return GROUPS.flatMap(group =>
    scored
      .filter(each => each.command.group === group)
      .toSorted((a, b) => b.score - a.score)
      .map(each => each.command),
  )
}

const ItemRow = ({
  command,
  selected,
  width,
}: {
  readonly command: Command
  readonly selected: boolean
  readonly width: number
}) => {
  const theme = useTheme()
  const { fit } = useText()

  const right =
    command.group === "Actions"
      ? fit(keyLabel(command.keys[0] ?? ""), KEY)
      : fit(command.detail ?? "", 16)

  const dot = command.status === undefined ? 0 : 2
  const title = Math.max(4, width - 2 - dot - right.length - 1)

  return (
    <text wrapMode="none" bg={selected ? theme.selection : undefined}>
      <span fg={theme.accent}>{selected ? "▌ " : "  "}</span>
      {command.status !== undefined && (
        <>
          <StatusDot status={command.status} />{" "}
        </>
      )}
      <span fg={theme.text}>{fit(command.title, title)} </span>
      <span fg={command.group === "Actions" ? theme.accent : theme.muted}>
        {right}
      </span>
    </text>
  )
}

/** Every command, repo and recent run, filtered as you type; ⏎ runs the selected one. */
export const CommandPalette = ({
  commands,
  close,
}: {
  readonly commands: ReadonlyArray<Command>
  readonly close: () => void
}) => {
  const theme = useTheme()
  const terminal = useTerminalDimensions()
  const [query, setQuery] = useState("")
  const [cursor, setCursor] = useState(0)
  const items = paletteItems(commands, query)
  const selected = Math.min(cursor, Math.max(0, items.length - 1))
  const width = Math.min(72, terminal.width - 8)

  const height = Math.max(
    3,
    Math.min(14, Math.floor(terminal.height * 0.6) - 4),
  )

  useKeyboard(key => {
    if (key.name === "escape") close()
    else if (key.name === "down" || (key.ctrl && key.name === "n"))
      setCursor(Math.min(items.length - 1, selected + 1))
    else if (key.name === "up" || (key.ctrl && key.name === "p"))
      setCursor(Math.max(0, selected - 1))
    else if (key.name === "return") {
      const command = items[selected]

      if (command === undefined) return
      close()
      command.run()
    }
  })

  const rows = GROUPS.flatMap((group): ReadonlyArray<Row> => {
    const inGroup = items.flatMap((command, index): ReadonlyArray<Row> =>
      command.group === group ? [{ kind: "item", command, index }] : [],
    )

    return inGroup.length === 0 ? [] : [{ kind: "header", group }, ...inGroup]
  })

  const at = rows.findIndex(
    row => row.kind === "item" && row.index === selected,
  )

  const { start, end } = visibleWindow(rows.length, at, height)

  return (
    <Dialog
      title="Commands"
      width={width}
      footer={[
        ["↑↓", "select"],
        ["return", "run"],
        ["escape", "close"],
      ]}
    >
      <box flexDirection="row" marginBottom={1}>
        <text fg={theme.accent}>{"› "}</text>
        <input
          focused
          flexGrow={1}
          placeholder="Type a command, repo or run"
          textColor={theme.text}
          focusedTextColor={theme.text}
          placeholderColor={theme.muted}
          backgroundColor={theme.surface}
          focusedBackgroundColor={theme.surface}
          cursorColor={theme.accent}
          onInput={value => {
            setQuery(value)
            setCursor(0)
          }}
        />
      </box>
      {items.length === 0 ? (
        <text fg={theme.muted}>No matches</text>
      ) : (
        rows.slice(start, end).map(row =>
          row.kind === "header" ? (
            <text key={row.group} wrapMode="none" fg={theme.muted}>
              <strong>{row.group.toUpperCase()}</strong>
            </text>
          ) : (
            <ItemRow
              key={row.command.id}
              command={row.command}
              selected={row.index === selected}
              width={width - 4}
            />
          ),
        )
      )}
    </Dialog>
  )
}
