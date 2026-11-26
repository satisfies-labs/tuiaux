import type { ReactNode } from "react";
import { useTheme } from "../context";

interface PanelProps {
  title: string;
  focused?: boolean;
  children: ReactNode;
  flexGrow?: number;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  bottomTitle?: string;
}

/** Rounded bordered panel. Focus is shown with the accent color only. */
export function Panel({ title, focused, children, flexGrow, width, height, bottomTitle }: PanelProps) {
  const theme = useTheme();
  return (
    <box
      border
      borderStyle="rounded"
      borderColor={focused ? theme.accent : theme.line}
      title={` ${title} `}
      titleColor={focused ? theme.accent : theme.text}
      bottomTitle={bottomTitle ? ` ${bottomTitle} ` : undefined}
      bottomTitleAlignment="right"
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      flexGrow={flexGrow}
      width={width}
      height={height}
    >
      {children}
    </box>
  );
}
