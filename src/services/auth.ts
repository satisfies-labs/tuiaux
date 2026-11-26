import type { ProviderId } from "../core/types";
import { run, runShell } from "./exec";

export interface TokenSource {
  token: string;
  source: string;
}

/**
 * Resolve an API token without ever storing one. Order:
 * 1. `token_command` from the config  2. environment variables  3. the official CLI (`gh` / `glab`).
 */
export async function resolveToken(
  provider: Exclude<ProviderId, "demo">,
  host: string,
  tokenCommand?: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TokenSource | undefined> {
  if (tokenCommand) {
    const token = await runShell(tokenCommand);
    if (token) return { token, source: "token_command" };
  }
  const vars =
    provider === "github"
      ? ["TUIAUX_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"]
      : ["TUIAUX_GITLAB_TOKEN", "GITLAB_TOKEN"];
  for (const v of vars) if (env[v]) return { token: env[v] as string, source: `$${v}` };

  const cli =
    provider === "github"
      ? await run(["gh", "auth", "token", "--hostname", host])
      : await run(["glab", "config", "get", "token", "--host", host]);
  if (cli) return { token: cli, source: provider === "github" ? "gh auth token" : "glab config" };
  return undefined;
}
