<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/tuiaux-logo-on-dark.svg">
    <img alt="tuiaux" src="assets/brand/tuiaux-logo-on-light.svg" width="330">
  </picture>
</p>

<p align="center"><b>Your CI pipelines, live in your terminal.</b><br>
GitHub Actions and GitLab CI in one keyboard-driven TUI, built with <a href="https://github.com/anomalyco/opentui">OpenTUI</a> and <a href="https://effect.website">Effect</a>.</p>

<p align="center">
  <a href="https://github.com/satisfies-labs/tuiaux/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/satisfies-labs/tuiaux/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/tuiaux"><img alt="npm" src="https://img.shields.io/npm/v/tuiaux"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-34D399"></a>
</p>

<p align="center"><img alt="tuiaux demo: dashboard, run details and themes" src="docs/design/demo.gif" width="900"></p>

## Why

- **Zero setup.** Run `tuiaux` in a repo: it finds the remote and reuses your `gh` / `glab` login. No token to paste anywhere.
- **Type it anywhere.** Every repo that showed runs is remembered, so `tuiaux` from any directory shows them all, GitHub and GitLab side by side.
- **Light on your API quota.** Only the repos that matter right now are polled (the current one, the one under the cursor, those with a running pipeline); the rest show their last known state.
- **Tells you when it's done.** A bell and a terminal notification when a run fails, or turns green again.
- **Your terminal, your colors.** Inherits your terminal theme by default; Tokyo Night, Catppuccin, Gruvbox, Nord… built in.

## Install

```sh
# npm (requires Bun ≥ 1.3)
bunx tuiaux

# standalone binary (Linux / macOS, x64 / arm64)
curl -fsSL https://github.com/satisfies-labs/tuiaux/releases/latest/download/tuiaux-$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/').tar.gz | tar -xz
./tuiaux --version
```

## Usage

```sh
tuiaux             # inside a repo: that repo first, then every remembered repo
tuiaux --help
```

**Dashboard**: repos on the left, the selected repo's runs and the selected run's jobs on the right.

| Key               | Action                                        |
| ----------------- | --------------------------------------------- |
| `↑` `↓` / `j` `k` | move                                          |
| `tab` / `h` `l`   | switch between repos and runs                 |
| `⏎`               | run details: jobs and their steps             |
| `w`               | watch the run: a compact view for a tmux pane |
| `o`               | open in the browser                           |
| `d`               | forget a remembered repo                      |
| `/` / `f`         | filter repos by name / show failing repos     |
| `r`               | refresh now (also retries a stopped host)     |
| `ctrl+k` `:` `?`  | command palette: every action, repo and run   |
| `1` `2` `3`       | dashboard, last run, its watch view           |
| `esc`             | back (or clear the filter)                    |
| `q`               | quit                                          |

## Authentication

tuiaux never stores tokens: it asks the official CLIs when it needs one and keeps it in memory.

| Host       | Token from                              | Scopes                                         |
| ---------- | --------------------------------------- | ---------------------------------------------- |
| github.com | `gh auth token` (`gh auth login` first) | `repo`, or fine-grained with _Actions: read_   |
| gitlab.com | `glab` (`glab auth login` first)        | `read_api`                                     |

GitHub Enterprise and self-hosted GitLab aren't supported yet.

## Configuration

`~/.config/tuiaux/config.toml`: created empty on first run, every key optional. A wrong value never stops tuiaux: it uses the default and tells you what was wrong.

```toml
[theme]
name = "terminal"          # or tokyo-night, catppuccin-mocha, gruvbox-dark, nord, …

[refresh]
active = 5                 # seconds between polls while something runs
idle = 30                  # … when nothing does

[notifications]
on = ["failure", "recovered"]
```

All keys: [`config.example.toml`](config.example.toml) and [docs/configuration.md](docs/configuration.md).

## Contributing

Contributions are welcome, new providers especially. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/architecture.md](docs/architecture.md).

## License

[MIT](LICENSE) © [Satisfies Labs](https://github.com/satisfies-labs) and tuiaux contributors. Logo font: [Departure Mono](https://departuremono.com) (OFL).
