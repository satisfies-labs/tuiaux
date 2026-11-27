# Roadmap

## v1 — Effect rebuild

- [x] Effect v4 architecture: domain, platform, providers, `Monitor`, UI (see `docs/architecture.md`, `docs/adr/`)
- [x] GitHub Actions and GitLab CI on github.com / gitlab.com, tokens from `gh` / `glab`
- [x] Remembered repos, hot/cold polling, ETag cache, per-repo backoff, host-wide pause on rate limits
- [x] Dashboard, run detail and watch views; built-in themes; config issues shown at startup
- [x] Notifications on settled runs: bell, OSC 9, OpenTUI's notification on kitty
- [x] Contextual help (`?`): the keys of the current view
- [x] Real run durations (GitHub timing, GitLab pipeline detail) and GitLab commit titles, fetched once and cached

## Before the first release

- [ ] Try it against a real GitLab project with `glab`, including a token kept in the system keyring
- [ ] Verify built-in theme colors against each theme's official repo
- [ ] README GIF (VHS tape in `docs/demo.tape`)
- [ ] First release: binaries

## v1.1

- [ ] Job logs in the run detail (GitHub `/actions/jobs/{id}/logs`, GitLab `/jobs/{id}/trace`), follow mode, jump to the error
- [ ] Rerun / cancel (with confirmation), exposed through provider `capabilities`
- [ ] User theme files in `~/.config/tuiaux/themes/*.toml`
- [ ] Repo list filtering (`/`)

## Ideas

Interactive only (ADR 0007) and credentials from `gh` / `glab` only (ADR 0004): ideas that need a
headless command, tokens in config or other hosts would need a new ADR first.

**Views and navigation**

- [ ] Pipeline graph: stages and `needs` dependencies drawn as an ASCII DAG
- [ ] Activity feed: settled runs across repos, newest first, fed by `Monitor.settled`
- [ ] Digest on startup: what broke and what shipped since the last visit, with a "new" badge per repo
- [ ] GitLab jobs grouped by stage, collapsible, in the run detail
- [ ] Quick jump (`Ctrl-K`): palette over remembered repos, workflows and branches
- [ ] Workspaces: named filters over remembered repos, each with its own theme and layout (compact, columns, density)

**Repos**

- [ ] Add a repo from anywhere: prompt with autocomplete over the user's GitHub / GitLab repos
- [ ] Pinned repos: kept on top and always hot
- [ ] Per-repo tracked branch: default, last local branch or all branches
- [ ] Open the repo's local path in a shell, `$EDITOR` or a new tmux window

**Insight**

- [ ] Failure streak on red repos ("red for 3 runs / 2 h")
- [ ] ETA for active runs, from the median duration of past runs of the same workflow
- [ ] Weekly report exported from the app: success rate, slowest workflows, flaky runs, as Markdown
- [ ] Shareable status card exported from the app: branded SVG of repo statuses

**Comfort**

- [ ] Copy run URL / SHA through OSC 52 (works over SSH and tmux)
- [ ] `terminal` theme follows live light/dark palette changes
- [ ] Startup dialog for a missing or logged-out `gh` / `glab`, with the fix command
- [ ] Notifications only for my runs, batched when several settle together

**Reach**

- [ ] GitHub Enterprise and self-hosted GitLab (needs ADR 0004 revisited)
- [ ] Local CI: run lint / test jobs locally (e.g. `act`) in the same UI (needs a headless runner, ADR 0007)
- [ ] More providers: Gitea / Forgejo Actions, Woodpecker, Buildkite
- [ ] Homebrew tap
- [ ] Windows support
