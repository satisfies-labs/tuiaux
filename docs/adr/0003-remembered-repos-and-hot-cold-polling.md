# Remembered repos, polled only when hot

A repo is remembered automatically the first time it shows at least one run, so `tuiaux` run anywhere still shows it. Only **hot** repos are polled: the current repo, the repo under the cursor, and repos with an active run. Cold repos are drawn from a disk cache and marked stale. This keeps API usage bounded however many repos have been visited. Remembered repos are forgotten only manually.

## Consequences

- App-written state is kept away from the user's config. `~/.local/state/tuiaux/repos.json` holds the list and `~/.cache/tuiaux/runs/` holds the disposable run cache. `config.toml` is never rewritten.
- A cold repo whose cached status is active is treated as hot, so it can't stay "running" forever.
- Notifications only fire for hot repos.
