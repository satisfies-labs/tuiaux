import { useTheme } from "../context";

export type Hint = readonly [key: string, label: string];

export function KeyHints({ hints }: { hints: readonly Hint[] }) {
  const theme = useTheme();
  return (
    <box height={1} backgroundColor={theme.surface} paddingLeft={1} flexDirection="row">
      <text>
        {hints.map(([k, label]) => (
          <span key={k}>
            <strong fg={theme.accent}>{k}</strong>
            <span fg={theme.muted}>{` ${label}    `}</span>
          </span>
        ))}
      </text>
    </box>
  );
}
