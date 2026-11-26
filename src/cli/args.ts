import { parseArgs } from "node:util";

export const HELP = `tuiaux — your CI pipelines, live in your terminal

Usage
  tuiaux [options]            dashboard (current repo + repos from the config)
  tuiaux watch [options]      follow the latest run of the current branch, exit with its result
  tuiaux status [--json]      print the latest status of each repo and exit
  tuiaux themes               list built-in themes
  tuiaux config               print the config file path and an example

Options
  -r, --repo <repo>   watch this repo (repeatable): github:owner/name, gitlab:group/project
  -t, --theme <name>  theme for this session (default: config, then "terminal")
  -c, --config <file> config file (default: $XDG_CONFIG_HOME/tuiaux/config.toml)
      --demo          fake data, no token needed
      --json          JSON output (status)
      --debug         verbose logs to the log file
  -v, --version       print version
  -h, --help          show this help

Exit codes (watch, status): 0 success · 1 failure · 2 other / error
`;

export function parseCli(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      repo: { type: "string", short: "r", multiple: true },
      theme: { type: "string", short: "t" },
      config: { type: "string", short: "c" },
      demo: { type: "boolean" },
      json: { type: "boolean" },
      debug: { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });
  const command = (positionals[0] ?? "dashboard") as "dashboard" | "watch" | "status" | "themes" | "config";
  return { command, ...values };
}

export type CliArgs = ReturnType<typeof parseCli>;
