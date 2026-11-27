import type { ReactNode } from "react"

import { useTerminalDimensions } from "@opentui/react"

import { useTheme } from "../theme"
import { type Hint, KeyHints } from "./key-hints"

/** A framed box centered over the view, `width` cells wide at most. */
export const Dialog = ({
  title,
  width,
  footer,
  children,
}: {
  readonly title: string
  readonly width: number
  readonly footer?: ReadonlyArray<Hint> | undefined
  readonly children: ReactNode
}) => {
  const theme = useTheme()
  const terminal = useTerminalDimensions()
  const cells = Math.max(10, Math.min(width, terminal.width - 4))

  return (
    <box
      position="absolute"
      top={Math.max(1, Math.floor(terminal.height / 4))}
      left={Math.floor((terminal.width - cells) / 2)}
      width={cells}
      zIndex={10}
      flexDirection="column"
      paddingX={1}
      border
      borderStyle="rounded"
      borderColor={theme.accent}
      title={` ${title} `}
      titleColor={theme.accent}
      backgroundColor={theme.surface}
    >
      {children}
      {footer !== undefined && (
        <box marginTop={1}>
          <KeyHints hints={footer} width={cells - 4} />
        </box>
      )}
    </box>
  )
}
