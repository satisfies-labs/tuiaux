import type { ReactNode } from "react"

import { useTheme } from "../theme"

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

  return (
    <box
      flexDirection="column"
      paddingX={1}
      border
      borderStyle="rounded"
      borderColor={focused ? theme.accent : theme.line}
      title={` ${title} `}
      titleColor={focused ? theme.accent : theme.text}
      bottomTitle={footer === undefined ? undefined : ` ${footer} `}
      bottomTitleAlignment="right"
      width={width}
      height={height}
      flexGrow={flexGrow}
    >
      {children}
    </box>
  )
}
