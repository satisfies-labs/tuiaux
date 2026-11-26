#!/usr/bin/env bun
import { ConfigError, loadConfig, paths } from "../config";
import type { Config } from "../config/schema";
import { exitCodeOf, isActive } from "../core/status";
import { repoKey } from "../core/types";
import { demoRepos } from "../providers/demo";
import { ProviderRegistry } from "../providers/registry";
import { logger } from "../services/logger";
import { notifyRun } from "../services/notify";
import { Poller, type PollTarget } from "../services/poller";
import { resolveTargets } from "../services/targets";
import { createStore, initialState } from "../state/store";
import { THEME_NAMES } from "../theme/themes";
import { VERSION } from "../version";
import { type CliArgs, HELP, parseCli } from "./args";

async function main(argv: string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parseCli(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (args.help) return print(HELP, 0);
  if (args.version) return print(`tuiaux ${VERSION}\n`, 0);
  logger.configure({ debug: args.debug });

  let config: Config;
  try {
    config = loadConfig(args.config);
  } catch (e) {
    if (e instanceof ConfigError) return print(`${e.message}\n`, 2, true);
    throw e;
  }

  switch (args.command) {
    case "themes":
      return print(`${THEME_NAMES.join("\n")}\n`, 0);
    case "config":
      return print(
        `${args.config ?? paths.configFile()}\n\nSee config.example.toml in the repository for every option.\n`,
        0,
      );
    case "status":
      return status(config, args);
    case "watch":
      return watch(config, args);
    case "dashboard":
      return dashboard(config, args);
    default:
      return print(`Unknown command "${args.command}".\n\n${HELP}`, 2, true);
  }
}

async function targetsFor(config: Config, args: CliArgs): Promise<PollTarget[]> {
  if (args.demo) return demoRepos().map((repo) => ({ repo }));
  return resolveTargets(config, process.cwd(), args.repo ?? []);
}

function setup(config: Config, args: CliArgs) {
  const themeName = args.theme ?? config.theme.name;
  const store = createStore(initialState(themeName));
  const registry = new ProviderRegistry(config, args.demo);
  return { store, registry, themeName };
}

async function dashboard(config: Config, args: CliArgs): Promise<number> {
  const targets = await targetsFor(config, args);
  if (targets.length === 0) return noRepos();
  const { store, registry, themeName } = setup(config, args);
  const poller = new Poller(store, registry, targets, config, {
    onRunSettled: (run) => {
      if (!config.notifications.enabled) return;
      if (config.notifications.on.includes(run.status === "failure" ? "failure" : "success")) {
        void notifyRun(run, { bell: config.notifications.bell });
      }
    },
  });
  poller.start();
  const { renderApp } = await import("../ui/render");
  return renderApp({ store, poller, config, themeName });
}

async function watch(config: Config, args: CliArgs): Promise<number> {
  const targets = (await targetsFor(config, args)).slice(0, 1);
  const target = targets[0];
  if (!target) return noRepos();
  if (!args.demo) {
    const { detectLocalRepo } = await import("../services/git");
    const local = await detectLocalRepo(process.cwd(), {
      github: config.github.host,
      gitlab: config.gitlab.host,
    });
    target.branch = local?.branch;
  }
  const { store, registry, themeName } = setup(config, args);
  const poller = new Poller(store, registry, targets, config, {
    onRunSettled: (run) => {
      if (config.notifications.enabled) void notifyRun(run, { bell: config.notifications.bell });
      setTimeout(() => store.set({ exitCode: exitCodeOf(run) }), 800);
    },
  });
  await poller.tick();
  const latest = store.get().repos[repoKey(target.repo)]?.runs[0];
  if (latest && !isActive(latest.status)) {
    return print(
      `${latest.status} · ${latest.workflow} #${latest.number} · ${latest.branch}\n`,
      exitCodeOf(latest),
    );
  }
  poller.start();
  const { renderApp } = await import("../ui/render");
  return renderApp({ store, poller, config, themeName, mode: "watch" });
}

async function status(config: Config, args: CliArgs): Promise<number> {
  const targets = await targetsFor(config, args);
  if (targets.length === 0) return noRepos();
  const { store, registry } = setup(config, args);
  const poller = new Poller(store, registry, targets, config);
  await poller.tick();
  const repos = Object.values(store.get().repos);
  const rows = repos.map((r) => ({
    repo: `${r.repo.host}/${r.repo.path}`,
    error: r.error,
    latest: r.runs[0],
  }));
  if (args.json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  } else {
    for (const r of rows) {
      const l = r.latest;
      process.stdout.write(
        `${(l?.status ?? (r.error ? "error" : "idle")).padEnd(10)} ${r.repo}${l ? `  ${l.workflow} #${l.number} (${l.branch})` : r.error ? `  ${r.error}` : ""}\n`,
      );
    }
  }
  if (rows.some((r) => r.latest?.status === "failure")) return 1;
  return rows.some((r) => r.error) ? 2 : 0;
}

function noRepos(): number {
  return print(
    "No repository to watch.\nRun tuiaux inside a git repo with a GitHub/GitLab remote, pass --repo, add repos to your config, or try --demo.\n",
    2,
    true,
  );
}

function print(text: string, code: number, toStderr = false): number {
  (toStderr ? process.stderr : process.stdout).write(text);
  return code;
}

main(Bun.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((e) => {
    logger.error("fatal", e);
    process.stderr.write(`tuiaux: ${(e as Error).message}\nSee logs: ${logger.file}\n`);
    process.exit(2);
  });
