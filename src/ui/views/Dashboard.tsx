import { toneOf } from "../../core/status";
import { elapsed, formatAge, formatDuration, truncate } from "../../core/time";
import { repoKey } from "../../core/types";
import type { ViewModel } from "../../state/selectors";
import type { Focus } from "../../state/store";
import { KeyHints } from "../components/KeyHints";
import { Panel } from "../components/Panel";
import { ProgressBar } from "../components/ProgressBar";
import { StatusDot } from "../components/StatusDot";
import { useTheme } from "../context";
import { useNow } from "../hooks";

const REPO_W = 44;

const jobLabel = (status: string, p: number) =>
  (status === "running"
    ? `${Math.round(p * 100)}%`.padStart(4)
    : status === "success"
      ? "done"
      : status
  ).padEnd(7);

export function Dashboard({ vm, focus, width }: { vm: ViewModel; focus: Focus; width: number }) {
  const theme = useTheme();
  const now = useNow(1000);
  const inner = Math.max(70, width - REPO_W - 7); // right panels' content width
  const commitW = inner - 60;
  const byProvider = (p: string) =>
    vm.repos.filter((r) => r.repo.provider === p || (p === "github" && r.repo.provider === "demo"));

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" flexGrow={1} gap={1}>
        {/* Repos */}
        <Panel
          title="Repos"
          focused={focus === "repos"}
          width={REPO_W}
          bottomTitle={`${vm.repos.length} repos`}
        >
          {(["github", "gitlab"] as const).map((p) => {
            const list = byProvider(p);
            if (list.length === 0) return null;
            return (
              <box key={p} flexDirection="column" marginBottom={1}>
                <text fg={theme.muted}>
                  <strong>{p.toUpperCase()}</strong>
                  {` · ${list[0]?.repo.host}`}
                </text>
                {list.map((r) => {
                  const latest = r.runs[0];
                  const selected = vm.repo && repoKey(vm.repo.repo) === repoKey(r.repo);
                  const age =
                    latest?.status === "running"
                      ? formatDuration(elapsed(latest.startedAt, undefined, now))
                      : formatAge(latest?.createdAt, now);
                  return (
                    <box
                      key={repoKey(r.repo)}
                      flexDirection="row"
                      backgroundColor={selected ? theme.selection : undefined}
                    >
                      <text wrapMode="none">
                        <span fg={theme.accent}>{selected ? "▌" : " "}</span>
                        <StatusDot status={latest?.status ?? "idle"} />
                        <span
                          fg={r.error ? theme.failure : theme.text}
                        >{` ${truncate(r.repo.path, 21).padEnd(22)}`}</span>
                        <span fg={theme.muted}>
                          {truncate(latest?.branch ?? r.branch ?? "", 8).padEnd(9)}
                        </span>
                        <span
                          fg={
                            latest && toneOf(latest.status) !== "success"
                              ? theme[toneOf(latest.status)]
                              : theme.muted
                          }
                        >
                          {(r.error ? "err" : age).padStart(5)}
                        </span>
                      </text>
                    </box>
                  );
                })}
              </box>
            );
          })}
        </Panel>

        <box flexDirection="column" flexGrow={1} gap={0}>
          {/* Runs */}
          <Panel title={`Runs · ${vm.repo?.repo.path ?? "—"}`} focused={focus === "runs"} height="45%">
            <text fg={theme.muted}>
              <strong>{`   ${"WORKFLOW".padEnd(13)}${"#".padEnd(6)}${"BRANCH".padEnd(13)}${"COMMIT".padEnd(commitW)}${"EVENT".padEnd(13)}${"TIME".padEnd(8)}AGE`}</strong>
            </text>
            {vm.repo?.error && <text fg={theme.failure}>{truncate(vm.repo.error, inner)}</text>}
            {vm.runs.slice(0, 12).map((run) => {
              const selected = vm.run?.id === run.id;
              const tone = toneOf(run.status);
              const dur = formatDuration(elapsed(run.startedAt, run.finishedAt, now));
              return (
                <box key={run.id} backgroundColor={selected ? theme.selection : undefined}>
                  <text wrapMode="none">
                    <span fg={theme.accent}>{selected ? "▌" : " "}</span>
                    <StatusDot status={run.status} />
                    <span fg={theme.text}>{` ${truncate(run.workflow, 12).padEnd(13)}`}</span>
                    <span fg={theme.muted}>{String(run.number).padEnd(6)}</span>
                    <span fg={theme.muted}>{truncate(run.branch, 12).padEnd(13)}</span>
                    <span fg={theme.text}>{truncate(run.commitMessage, commitW - 1).padEnd(commitW)}</span>
                    <span fg={theme.muted}>{truncate(run.event, 12).padEnd(13)}</span>
                    <span fg={tone === "running" || tone === "failure" ? theme[tone] : theme.muted}>
                      {dur.padEnd(8)}
                    </span>
                    <span fg={theme.muted}>{formatAge(run.createdAt, now)}</span>
                  </text>
                </box>
              );
            })}
          </Panel>

          {/* Jobs */}
          <Panel
            title={
              vm.run
                ? `Jobs · ${vm.run.workflow} #${vm.run.number} · ${vm.run.commitSha.slice(0, 7)}`
                : "Jobs"
            }
            focused={focus === "jobs"}
            flexGrow={1}
          >
            {vm.jobsError && <text fg={theme.failure}>{vm.jobsError}</text>}
            {vm.jobs.map((job) => {
              const p = job.progress ?? (job.status === "success" ? 1 : 0);
              const barW = Math.max(10, inner - 38);
              return (
                <text key={job.id}>
                  <StatusDot status={job.status} />
                  <span
                    fg={job.status === "queued" || job.status === "skipped" ? theme.muted : theme.text}
                  >{` ${truncate(job.name, 18).padEnd(19)}`}</span>
                  <ProgressBar value={p} width={barW} status={job.status} />
                  <span fg={job.status === "running" ? theme.running : theme.muted}>
                    {`  ${jobLabel(job.status, p)}`}
                  </span>
                  <span
                    fg={theme.muted}
                  >{`  ${formatDuration(elapsed(job.startedAt, job.finishedAt, now))}`}</span>
                </text>
              );
            })}
          </Panel>
        </box>
      </box>
      <KeyHints
        hints={[
          ["↑↓", "navigate"],
          ["tab", "panel"],
          ["⏎", "details"],
          ["o", "open"],
          ["r", "refresh"],
          ["t", "theme"],
          ["q", "quit"],
        ]}
      />
    </box>
  );
}
