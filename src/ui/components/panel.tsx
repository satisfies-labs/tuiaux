import type { ReactNode } from "react"

import { useText } from "../text"
import { useTheme } from "../theme"

/** Cells inside a panel `width` wide: borders and horizontal padding. */
export const panelInner = (width: number): number => Math.max(0, width - 4)

/** A rounded, titled box. Focus shows in the accent color only. */
export const Panel = ({
  title,
  footer,
  focused = false,
  width,
  height,
  flexGrow,
  children,
}: {
  readonly title: string
  readonly footer?: string | undefined
  readonly focused?: boolean
  readonly width?: number
  readonly height?: number
  readonly flexGrow?: number
  readonly children: ReactNode
}) => {
  const theme = useTheme()
  const { fit } = useText()

  // A title wider than the box isn't drawn at all: cut it to fit instead.
  const fitted = (text: string) =>
    width === undefined ? text : fit(text, Math.max(1, width - 6)).trimEnd()

  return (
    <box
      flexDirection="column"
      paddingX={1}
      border
      borderStyle="rounded"
      borderColor={focused ? theme.accent : theme.line}
      title={` ${fitted(title)} `}
      titleColor={focused ? theme.accent : theme.text}
      bottomTitle={footer === undefined ? undefined : ` ${fitted(footer)} `}
      bottomTitleAlignment="right"
      width={width}
      height={height}
      flexGrow={flexGrow}
    >
      {children}
    </box>
  )
}
