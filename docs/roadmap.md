# Roadmap

## v0.1 — first public release

- [x] Domain model, status folding, urgency sort
- [x] GitHub Actions + GitHub Enterprise provider
- [x] GitLab (gitlab.com + self-hosted) provider
- [x] Poller: adaptive pace, ETag, per-repo backoff
- [x] Dashboard, run detail, watch views; themes; keyboard navigation
- [x] `watch` / `status --json` with exit codes, notifications
- [ ] Verify built-in theme colors against each theme's official repo
- [ ] Repo list filtering (`/`) and run pagination
- [ ] README GIF (VHS tape in `docs/demo.tape`)
- [ ] First release: binaries + npm

## v1.1

- [ ] Job logs in the detail view (GitHub `/actions/jobs/{id}/logs`, GitLab `/jobs/{id}/trace`), follow mode, jump to error
- [ ] Rerun / cancel (`r` / `c` with confirmation)
- [ ] GitLab commit titles (cached per sha)
- [ ] User theme files in `~/.config/tuiaux/themes/*.toml`

## Later

- [ ] Pipeline graph view: stages and `needs` dependencies drawn as an ASCII DAG
- [ ] Weekly report export (`tuiaux report`): success rate, slowest workflows, flaky runs, as Markdown
- [ ] Workspaces (`--workspace <name>`, switch in-app): any number of user-defined workspaces, each with its own
  - repos, hosts and tokens
  - theme (built-in or custom)
  - layout: view (dashboard, compact, watch…), visible panels and columns, density, sort/filter defaults
- [ ] Morning digest (`tuiaux digest`): what broke, what shipped and pending PRs/MRs since yesterday
- [ ] Shareable status card (`tuiaux card`): branded SVG/PNG of repo statuses for READMEs and social posts
- [ ] Local CI (`tuiaux local`): run lint/test jobs from the workflow locally (e.g. via `act`) in the same UI
- [ ] Add a repo from anywhere (`a`): prompt with autocomplete over the user's GitHub/GitLab repos, then remembered
- [ ] Pinned repos (`p`): kept on top and always hot
- [ ] Quick jump (`Ctrl-K`): palette over remembered repos, workflows and branches
- [ ] Per-repo tracked branch: default, last local branch or all branches, switchable from the row
- [ ] Open the repo's local path in a shell, `$EDITOR` or a new tmux window
- [ ] Activity feed: chronological panel of settled runs across repos, fed by `Monitor.settled`
- [ ] "New since last visit" badge per repo
- [ ] Failure streak on red repos ("red for 3 runs / 2h")
- [ ] GitLab jobs grouped by stage, collapsible, in run detail
- [ ] ETA for active runs from the median duration of past runs of the same workflow
- [ ] Copy run URL (`y`) / SHA (`Y`) via OSC 52 (works over SSH and tmux)
- [ ] `terminal` theme follows live light/dark palette changes
- [ ] Contextual help (`?`): only the keys of the current view and provider capabilities
- [ ] Startup dialog also reports missing or logged-out `gh` / `glab` with the fix command
- [ ] Notifications: only my runs (actor = `gh`/`glab` user), batched when several settle together
- [ ] More providers: Gitea/Forgejo Actions, Woodpecker, Buildkite
- [ ] Homebrew tap
- [ ] Windows support
