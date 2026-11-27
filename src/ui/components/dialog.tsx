import type { ReactNode } from "react"

import { useTheme } from "../theme"

/** A framed box drawn over the view. */
export const Dialog = ({
  title,
  children,
}: {
  readonly title: string
  readonly children: ReactNode
}) => {
  const theme = useTheme()

  return (
    <box
      position="absolute"
      top="25%"
      left="10%"
      width="80%"
      zIndex={10}
      flexDirection="column"
      padding={1}
      border
      borderStyle="rounded"
      borderColor={theme.accent}
      title={` ${title} `}
      backgroundColor={theme.surface}
    >
      {children}
    </box>
  )
}
