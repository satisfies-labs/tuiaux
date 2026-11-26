import type { Config } from "../config/schema";
import type { ProviderId, RepoRef } from "../core/types";
import { resolveToken } from "../services/auth";
import { logger } from "../services/logger";
import { createDemoProvider } from "./demo";
import { createGithubProvider } from "./github";
import { createGitlabProvider } from "./gitlab";
import { AuthMissingError, type Provider } from "./types";

/** Lazily builds one Provider per (provider, host), resolving tokens on first use. */
export class ProviderRegistry {
  private readonly cache = new Map<string, Promise<Provider>>();

  constructor(
    private readonly config: Config,
    private readonly demo = false,
  ) {}

  for(repo: RepoRef): Promise<Provider> {
    const id: ProviderId = this.demo ? "demo" : repo.provider;
    const key = `${id}:${repo.host}`;
    let p = this.cache.get(key);
    if (!p) {
      p = this.create(id, repo.host);
      p.catch(() => this.cache.delete(key)); // allow retry after e.g. `gh auth login`
      this.cache.set(key, p);
    }
    return p;
  }

  private async create(id: ProviderId, host: string): Promise<Provider> {
    if (id === "demo") return createDemoProvider();
    const cmd = id === "github" ? this.config.github.token_command : this.config.gitlab.token_command;
    const auth = await resolveToken(id, host, cmd);
    if (!auth) throw new AuthMissingError(id, host);
    logger.info(`auth ${id}@${host} via ${auth.source}`);
    return id === "github"
      ? createGithubProvider({ host, token: auth.token })
      : createGitlabProvider({ host, token: auth.token });
  }
}
