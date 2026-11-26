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

- [ ] More providers: Gitea/Forgejo Actions, Woodpecker, Buildkite
- [ ] Homebrew tap
- [ ] Windows support
