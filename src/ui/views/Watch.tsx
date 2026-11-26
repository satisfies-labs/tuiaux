import { isActive, toneOf } from "../../core/status";
import { elapsed, formatDuration } from "../../core/time";
import type { ViewModel } from "../../state/selectors";
import { Panel } from "../components/Panel";
import { ProgressBar } from "../components/ProgressBar";
import { StatusDot } from "../components/StatusDot";
import { useTheme } from "../context";
import { useNow } from "../hooks";

/** Compact single-run view for `tuiaux watch` (fits a 60×9 tmux pane). */
export function Watch({ vm, width }: { vm: ViewModel; width: number }) {
  const theme = useTheme();
  const now = useNow(1000);
  const run = vm.run;
  const done = vm.jobs.filter((j) => !isActive(j.status)).length;
  const progress = vm.jobs.length ? done / vm.jobs.length : 0;
  const barW = Math.max(10, width - 12);
  const compact = vm.jobs.reduce((n, j) => n + j.name.length + 5, 0) > width - 4;
  return (
    <Panel title="tuiaux watch" focused flexGrow={1}>
      {!run ? (
        <text fg={theme.muted}>Waiting for a run on this branch…</text>
      ) : (
        <box flexDirection="column" gap={1}>
          <box flexDirection="row" justifyContent="space-between">
            <text>
              <StatusDot status={run.status} />
              <strong fg={theme.text}>{` ${run.repo.path.split("/").pop()}`}</strong>
              <span fg={theme.muted}>{` · ${run.workflow} #${run.number} · ${run.branch}`}</span>
            </text>
            <text fg={theme[toneOf(run.status)]}>
              {formatDuration(elapsed(run.startedAt, run.finishedAt, now))}
            </text>
          </box>
          <text>
            <ProgressBar value={isActive(run.status) ? progress : 1} width={barW} status={run.status} />
            <span fg={theme.muted}>{`  ${Math.round((isActive(run.status) ? progress : 1) * 100)}%`}</span>
          </text>
          <text wrapMode="none">
            {vm.jobs.map((j) => (
              <span key={j.id}>
                <StatusDot status={j.status} />
                {/* names only when they fit, otherwise a compact row of dots */}
                {compact ? (
                  " "
                ) : (
                  <span fg={j.status === "queued" ? theme.muted : theme.text}>{` ${j.name}   `}</span>
                )}
              </span>
            ))}
            {compact && <span fg={theme.muted}>{` ${done}/${vm.jobs.length} jobs`}</span>}
          </text>
        </box>
      )}
    </Panel>
  );
}
