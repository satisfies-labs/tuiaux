import { toneOf } from "../../core/status";
import { elapsed, formatDuration, truncate } from "../../core/time";
import type { ViewModel } from "../../state/selectors";
import { KeyHints } from "../components/KeyHints";
import { Panel } from "../components/Panel";
import { StatusDot } from "../components/StatusDot";
import { useTheme } from "../context";
import { useNow } from "../hooks";

export function RunDetail({ vm }: { vm: ViewModel }) {
  const theme = useTheme();
  const now = useNow(1000);
  const run = vm.run;
  if (!run) return <text fg={theme.muted}>No run selected.</text>;
  const tone = toneOf(run.status);

  return (
    <box flexDirection="column" flexGrow={1}>
      <box height={1} flexDirection="row" justifyContent="flex-end">
        <text fg={theme[tone]}>
          {`● ${run.status} in ${formatDuration(elapsed(run.startedAt, run.finishedAt, now))} · ${run.event} on ${run.branch}`}
        </text>
      </box>
      <box flexDirection="row" flexGrow={1} gap={1}>
        <Panel title="Jobs" focused width={34}>
          {vm.jobs.map((j) => (
            <box key={j.id} backgroundColor={vm.job?.id === j.id ? theme.selection : undefined}>
              <text>
                <span fg={theme.accent}>{vm.job?.id === j.id ? "▌" : " "}</span>
                <StatusDot status={j.status} />
                <span
                  fg={j.status === "skipped" || j.status === "queued" ? theme.muted : theme.text}
                >{` ${truncate(j.name, 18).padEnd(19)}`}</span>
                <span fg={j.status === "failure" ? theme.failure : theme.muted}>
                  {formatDuration(elapsed(j.startedAt, j.finishedAt, now)).padStart(7)}
                </span>
              </text>
            </box>
          ))}
          {vm.job && vm.job.steps.length > 0 && (
            <box flexDirection="column" marginTop={1}>
              <text fg={theme.muted}>
                <strong>STEPS</strong>
                {` · ${vm.job.name}`}
              </text>
              {vm.job.steps.map((s) => (
                <text key={s.name}>
                  {" "}
                  <StatusDot status={s.status} animate={false} />
                  <span
                    fg={s.status === "skipped" ? theme.muted : theme.text}
                  >{` ${truncate(s.name, 22).padEnd(23)}`}</span>
                  <span fg={theme.muted}>
                    {formatDuration(elapsed(s.startedAt, s.finishedAt, now)).padStart(6)}
                  </span>
                </text>
              ))}
            </box>
          )}
        </Panel>
        <Panel title={`Log · ${vm.job?.name ?? "—"}`} flexGrow={1}>
          {/* TODO(v1.1): stream job logs (GitHub: /actions/jobs/{id}/logs, GitLab: /jobs/{id}/trace). */}
          <text fg={theme.muted}>Logs arrive in v1.1.</text>
          <text fg={theme.muted}>
            {"Press "}
            <strong fg={theme.accent}>o</strong>
            {" to open this job in your browser."}
          </text>
        </Panel>
      </box>
      <KeyHints
        hints={[
          ["esc", "back"],
          ["↑↓", "job"],
          ["o", "open"],
          ["r", "refresh"],
          ["q", "quit"],
        ]}
      />
    </box>
  );
}
