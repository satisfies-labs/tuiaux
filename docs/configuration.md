# Configuration

File: `$XDG_CONFIG_HOME/tuiaux/config.toml` (default `~/.config/tuiaux/config.toml`, also on macOS). tuiaux creates it empty when it's missing and only ever reads it, once, at startup.

Every key is optional. An invalid value, an unknown key or a TOML syntax error never stops tuiaux: the defaults are used for what's wrong and the problems are listed in a dialog when the TUI opens.

The annotated reference is [`config.example.toml`](../config.example.toml). Source of truth: `src/platform/config.ts`.

| Key                     | Default                   | Description                                                                 |
| ----------------------- | ------------------------- | --------------------------------------------------------------------------- |
| `theme.name`            | `"terminal"`              | Built-in theme; `terminal` inherits the terminal's colors                    |
| `theme.colors.<token>`  | —                         | Per-token override: `#rrggbb`, `default`, `ansi:0..15`                       |
| `refresh.active`        | `5`                       | Seconds between polls of a hot repo while a run is in progress (2–300)       |
| `refresh.idle`          | `30`                      | Seconds between polls of a hot repo when nothing runs (5–3600)               |
| `notifications.enabled` | `true`                    | Notify when a run settles (OSC 9, or OpenTUI's notification on kitty)        |
| `notifications.bell`    | `true`                    | Also ring the terminal bell                                                  |
| `notifications.on`      | `["failure","recovered"]` | Which settled runs notify: `failure`, `recovered`, `success` (includes `recovered`) |

Tokens: `bg surface selection line text muted accent success running failure idle`.

## What isn't in the config

- **Repos.** tuiaux remembers every repo that showed at least one run (`d` in the dashboard forgets one).
- **Tokens and hosts.** Tokens come from `gh` / `glab`; v1 talks to github.com and gitlab.com only (ADR 0004).

## Files tuiaux writes

| Path                                    | What                                      |
| --------------------------------------- | ----------------------------------------- |
| `$XDG_STATE_HOME/tuiaux/repos.json`     | Remembered repos                          |
| `$XDG_STATE_HOME/tuiaux/tuiaux.log`     | Logs (`TUIAUX_LOG=Debug` for more detail) |
| `$XDG_CACHE_HOME/tuiaux/runs/*.json`    | Last known runs per repo, safe to delete  |

Defaults: `~/.local/state` and `~/.cache`. Tokens are never written anywhere.
