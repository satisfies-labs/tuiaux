import type { Config, RepoEntry } from "../config/schema";
import type { RepoRef } from "../core/types";
import { detectLocalRepo } from "./git";
import type { PollTarget } from "./poller";

/** `github:owner/name`, `gitlab:group/project`, `gitlab.example.org:group/project`. */
export function parseRepoEntry(entry: RepoEntry, config: Config): PollTarget {
  if (typeof entry !== "string") {
    const host = entry.host ?? (entry.provider === "github" ? config.github.host : config.gitlab.host);
    return { repo: { provider: entry.provider, host, path: entry.path }, branch: entry.branch };
  }
  const idx = entry.indexOf(":");
  const prefix = idx > 0 ? entry.slice(0, idx) : "github";
  const path = idx > 0 ? entry.slice(idx + 1) : entry;
  let repo: RepoRef;
  if (prefix === "github") repo = { provider: "github", host: config.github.host, path };
  else if (prefix === "gitlab") repo = { provider: "gitlab", host: config.gitlab.host, path };
  else repo = { provider: prefix.includes("github") ? "github" : "gitlab", host: prefix, path };
  return { repo };
}

/** Repos to watch: `--repo` flags, else the config list, else the current git repo. */
export async function resolveTargets(
  config: Config,
  cwd: string,
  cliRepos: string[] = [],
): Promise<PollTarget[]> {
  const entries = cliRepos.length > 0 ? cliRepos : config.repos;
  const targets = entries.map((e) => parseRepoEntry(e, config));
  const local = await detectLocalRepo(cwd, { github: config.github.host, gitlab: config.gitlab.host });
  if (local) {
    const exists = targets.some((t) => t.repo.host === local.repo.host && t.repo.path === local.repo.path);
    if (!exists) targets.unshift({ repo: local.repo });
  }
  return targets;
}
