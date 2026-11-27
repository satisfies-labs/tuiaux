import { type ReactNode, useContext, useEffect } from "react"

import { useAtom, useAtomValue } from "@effect/atom-react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"

import { useMonitorState } from "../app-context"
import { type Command, GlobalCommandsContext, matchKey } from "../commands"
import { describeError } from "../describe"
import { flashAtom, overlayAtom } from "../overlay"
import { useTheme } from "../theme"
import { type Hint, KeyHints } from "./key-hints"
import { OverlayHost } from "./overlay-host"

const FLASH_MS = 3000

/**
 * A view's frame: the only key dispatcher, the status line and the open overlay.
 * The view's commands come first, then the app's.
 */
export const Screen = ({
  commands,
  children,
}: {
  readonly commands: ReadonlyArray<Command>
  readonly children: ReactNode
}) => {
  const theme = useTheme()
  const { width } = useTerminalDimensions()
  const { hostIssues } = useMonitorState()
  const overlay = useAtomValue(overlayAtom)
  const [flash, setFlash] = useAtom(flashAtom)
  const all = [...commands, ...useContext(GlobalCommandsContext)]

  useKeyboard(key => {
    if (overlay === undefined) matchKey(all, key)?.run()
  })

  useEffect(() => {
    if (flash === undefined) return

    const timer = setTimeout(() => setFlash(undefined), FLASH_MS)

    return () => clearTimeout(timer)
  }, [flash, setFlash])

  const hints = all.flatMap((command): ReadonlyArray<Hint> => {
    const key = command.hintKey ?? command.keys[0]

    return command.hint === undefined || key === undefined
      ? []
      : [[key, command.hint]]
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="column" flexGrow={1}>
        {children}
      </box>
      <box
        height={1}
        flexShrink={0}
        paddingX={1}
        backgroundColor={theme.surface}
      >
        {hostIssues.length > 0 ? (
          <text wrapMode="none" fg={theme.failure}>
            {hostIssues.map(describeError).join("  ·  ")}
          </text>
        ) : flash === undefined ? (
          <KeyHints
            hints={hints}
            width={width - 2}
            tail={["ctrl+k", "commands"]}
          />
        ) : (
          <text wrapMode="none" fg={theme.text}>
            {flash}
          </text>
        )}
      </box>
      <OverlayHost commands={all} />
    </box>
  )
}
