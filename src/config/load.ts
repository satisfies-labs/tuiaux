import { existsSync, readFileSync } from "node:fs";
import { paths } from "./paths";
import { type Config, configSchema } from "./schema";

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly file: string,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

export const defaultConfig = (): Config => configSchema.parse({});

/** Parse and validate a TOML string. Throws ConfigError with a readable, path-prefixed message. */
export function parseConfig(source: string, file = "<inline>"): Config {
  let raw: unknown;
  try {
    raw = Bun.TOML.parse(source);
  } catch (e) {
    throw new ConfigError(`${file}: invalid TOML — ${(e as Error).message}`, file);
  }
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new ConfigError(`${file}: invalid configuration\n${lines.join("\n")}`, file);
  }
  return result.data;
}

/** Load the config file if it exists, otherwise defaults. */
export function loadConfig(file: string = paths.configFile()): Config {
  if (!existsSync(file)) return defaultConfig();
  return parseConfig(readFileSync(file, "utf8"), file);
}
