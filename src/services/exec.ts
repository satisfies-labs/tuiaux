/** Run a command and return trimmed stdout, or undefined if it fails or is missing. Never throws. */
export async function run(
  cmd: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(cmd, { cwd: opts.cwd, stdout: "pipe", stderr: "ignore", stdin: "ignore" });
    const timer = setTimeout(() => proc.kill(), opts.timeoutMs ?? 3000);
    const out = await new Response(proc.stdout).text();
    clearTimeout(timer);
    if ((await proc.exited) !== 0) return undefined;
    return out.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Run a user-provided shell command (e.g. `token_command = "pass show gitlab"`). */
export const runShell = (command: string) => run(["sh", "-c", command], { timeoutMs: 10_000 });
