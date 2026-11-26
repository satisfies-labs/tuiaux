import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { paths } from "../config/paths";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let minLevel: Level = "info";
let file = paths.logFile();

/** File logger. Never writes to stdout/stderr: the TUI owns the terminal. */
export const logger = {
  configure(opts: { debug?: boolean; file?: string }) {
    if (opts.debug) minLevel = "debug";
    if (opts.file) file = opts.file;
  },
  get file() {
    return file;
  },
  debug: (msg: string, data?: unknown) => write("debug", msg, data),
  info: (msg: string, data?: unknown) => write("info", msg, data),
  warn: (msg: string, data?: unknown) => write("warn", msg, data),
  error: (msg: string, data?: unknown) => write("error", msg, data),
};

function write(level: Level, msg: string, data?: unknown) {
  if (ORDER[level] < ORDER[minLevel] || process.env.NODE_ENV === "test") return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    const extra = data === undefined ? "" : ` ${safe(data)}`;
    appendFileSync(file, `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${msg}${extra}\n`);
  } catch {
    // logging must never crash the app
  }
}

function safe(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
