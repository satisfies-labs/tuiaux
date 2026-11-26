<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/tuiaux-logo-on-dark.svg">
    <img alt="tuiaux" src="assets/brand/tuiaux-logo-on-light.svg" width="330">
  </picture>
</p>

<p align="center"><b>Your CI pipelines, live in your terminal.</b><br>
GitHub Actions and GitLab CI (self-hosted too) in one keyboard-driven TUI, built with <a href="https://github.com/anomalyco/opentui">OpenTUI</a>.</p>

<p align="center">
  <a href="https://github.com/satisfies-labs/tuiaux/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/satisfies-labs/tuiaux/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/tuiaux"><img alt="npm" src="https://img.shields.io/npm/v/tuiaux"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-34D399"></a>
</p>

<p align="center"><img alt="tuiaux demo: dashboard, run details and themes" src="docs/design/demo.gif" width="900"></p>

## Why

- **Zero setup.** Run `tuiaux` in a repo: it finds the remote, reuses your `gh` / `glab` login, and shows the runs.
- **All your repos at a glance.** GitHub and GitLab side by side, sorted so what's red or running comes first.
- **Your terminal, your colors.** Inherits your terminal theme by default; Tokyo Night, Catppuccin, Gruvbox, Nord… built in.
- **Made for tmux.** `tuiaux watch` follows the current branch in a tiny pane, notifies you, and exits with the run's result.

## Install

```sh
# npm (requires Bun ≥ 1.3)
bunx tuiaux

# standalone binary (Linux / macOS, x64 / arm64)
curl -fsSL https://github.com/satisfies-labs/tuiaux/releases/latest/download/tuiaux-$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/').tar.gz | tar -xz
./tuiaux --version
```

Try it without any token: `tuiaux --demo`.

## Usage

```sh
tuiaux                     # dashboard: current repo + repos from your config
tuiaux watch               # follow the current branch's latest run (exit 0 / 1)
tuiaux watch && git push   # …and chain it
tuiaux status --json       # one-shot status for scripts
tuiaux --repo gitlab:group/project --theme catppuccin-mocha
```

| Key               | Action          |
| ----------------- | --------------- |
| `↑` `↓` / `j` `k` | move            |
| `tab`             | next panel      |
| `⏎`               | run details     |
| `esc`             | back            |
| `o`               | open in browser |
| `r`               | refresh now     |
| `t`               | cycle themes    |
| `q`               | quit            |

## Authentication

tuiaux never stores tokens. For each host it tries, in order:

1. `token_command` from the config (e.g. `pass show github/token`)
2. `TUIAUX_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN` — `TUIAUX_GITLAB_TOKEN` / `GITLAB_TOKEN`
3. `gh auth token --hostname <host>` — `glab config get token --host <host>`

Scopes: GitHub `repo` (or fine-grained _Actions: read_), GitLab `read_api`.

## Configuration

`~/.config/tuiaux/config.toml` — every key is optional. See [`config.example.toml`](config.example.toml) and [docs/configuration.md](docs/configuration.md).

```toml
repos = ["github:satisfies-labs/tuiaux", "git.company.io:infra/k8s"]

[theme]
name = "terminal"

[theme.colors]
success = "#9ece6a"
```

## Contributing

Contributions are welcome — new providers especially. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/architecture.md](docs/architecture.md).

## License

[MIT](LICENSE) © [Satisfies Labs](https://github.com/satisfies-labs) and tuiaux contributors. Logo font: [Departure Mono](https://departuremono.com) (OFL).
