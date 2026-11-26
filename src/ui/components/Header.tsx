import { summarize } from "../../core/status";
import { formatAge } from "../../core/time";
import type { RepoState } from "../../core/types";
import { VERSION } from "../../version";
import { useTheme } from "../context";
import { useNow } from "../hooks";

export function Header({
  repos,
  lastRefresh,
  crumbs,
}: {
  repos: RepoState[];
  lastRefresh?: Date;
  crumbs?: string[];
}) {
  const theme = useTheme();
  const now = useNow(1000);
  const s = summarize(repos);
  return (
    <box flexDirection="column" height={3}>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <text>
          <span fg={theme.success}>●</span> <strong fg={theme.text}>tuiaux</strong>
          <span fg={theme.muted}>{` ${VERSION}`}</span>
          {crumbs?.map((c, i) => (
            <span key={c} fg={i === crumbs.length - 1 ? theme.text : theme.muted}>{`  ›  ${c}`}</span>
          ))}
        </text>
        <text fg={theme.muted}>
          {`↓ ${lastRefresh ? formatAge(lastRefresh, now) : "…"}   theme: ${theme.name}`}
        </text>
      </box>
      <box height={1} border={["bottom"]} borderColor={theme.line} />
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <text>
          <span fg={theme.text}>{`${s.total} pipelines   `}</span>
          <span fg={theme.success}>{`● ${s.success} passing   `}</span>
          <span fg={theme.running}>{`◌ ${s.running} running   `}</span>
          <span fg={theme.failure}>{`● ${s.failure} failed   `}</span>
          <span fg={theme.idle}>{`○ ${s.idle} idle`}</span>
        </text>
        <text fg={theme.muted}>sort: status ↓</text>
      </box>
    </box>
  );
}
