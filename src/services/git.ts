import type { ProviderId, RepoRef } from "../core/types";
import { run } from "./exec";

export interface ParsedRemote {
  host: string;
  path: string;
}

/**
 * Parse any common git remote URL:
 *   git@github.com:owner/repo.git · https://github.com/owner/repo · ssh://git@gitlab.example.org:2222/g/sub/p.git
 */
export function parseRemote(url: string): ParsedRemote | undefined {
  const u = url.trim();
  const scp = u.match(/^[\w.-]+@([^:/]+):(?!\d+\/)(.+?)(?:\.git)?\/?$/);
  if (scp?.[1] && scp[2]) return { host: scp[1].toLowerCase(), path: scp[2] };
  try {
    const parsed = new URL(u);
    const path = parsed.pathname
      .replace(/^\/+/, "")
      .replace(/\.git\/?$/, "")
      .replace(/\/+$/, "");
    if (!parsed.hostname || !path.includes("/")) return undefined;
    return { host: parsed.hostname.toLowerCase(), path };
  } catch {
    return undefined;
  }
}

/** Guess the provider from the host and the configured hosts. */
export function providerForHost(
  host: string,
  known: { github: string; gitlab: string },
): ProviderId | undefined {
  if (host === known.github || host === "github.com" || host.startsWith("github.")) return "github";
  if (host === known.gitlab || host === "gitlab.com" || host.includes("gitlab")) return "gitlab";
  return undefined;
}

export interface LocalRepo {
  repo: RepoRef;
  branch?: string;
}

/** Detect the repo (and checked-out branch) of the current working directory. */
export async function detectLocalRepo(
  cwd: string,
  known: { github: string; gitlab: string },
): Promise<LocalRepo | undefined> {
  const url = await run(["git", "remote", "get-url", "origin"], { cwd });
  if (!url) return undefined;
  const remote = parseRemote(url);
  if (!remote) return undefined;
  const provider = providerForHost(remote.host, known);
  if (!provider) return undefined;
  const branch = await run(["git", "rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  return { repo: { provider, ...remote }, branch: branch && branch !== "HEAD" ? branch : undefined };
}
