import type { Run } from "../core/types";
import { run } from "./exec";
import { logger } from "./logger";

export interface NotifyOptions {
  bell: boolean;
  /** Write escape sequences to this stream (the TUI's stdout). */
  out?: NodeJS.WriteStream;
}

/** Terminal-first notification: BEL + OSC 9 (iTerm2, WezTerm, kitty, Ghostty…), then the OS notifier. */
export async function notifyRun(r: Run, opts: NotifyOptions): Promise<void> {
  const title =
    r.status === "failure" ? "✗ CI failed" : r.status === "success" ? "✓ CI passed" : "CI finished";
  const body = `${r.repo.path} · ${r.workflow} #${r.number} · ${r.branch}`;
  const out = opts.out ?? process.stdout;
  try {
    if (opts.bell) out.write("\x07");
    out.write(`\x1b]9;${title} — ${body}\x07`);
  } catch (e) {
    logger.debug("terminal notification failed", e);
  }
  if (process.platform === "darwin") {
    await run([
      "osascript",
      "-e",
      `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`,
    ]);
  } else {
    await run(["notify-send", "--app-name=tuiaux", title, body]);
  }
}
