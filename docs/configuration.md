# Configuration

File: `$XDG_CONFIG_HOME/tuiaux/config.toml` (default `~/.config/tuiaux/config.toml`), or `--config <file>`. Every key is optional; an invalid file stops tuiaux with a message pointing at the bad key.

The annotated reference is [`config.example.toml`](../config.example.toml). Schema source of truth: `src/config/schema.ts`.

| Key                     | Default                   | Description                                                                                                         |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `repos`                 | `[]`                      | Extra repos: `"github:owner/name"`, `"gitlab:group/project"`, `"host:path"` or `{ provider, path, host?, branch? }` |
| `theme.name`            | `"terminal"`              | Theme (`tuiaux themes`)                                                                                             |
| `theme.colors.<token>`  | —                         | Per-token override: `#rrggbb`, `default`, `ansi:0..15`                                                              |
| `refresh.active`        | `5`                       | Seconds between polls while something runs (2–300)                                                                  |
| `refresh.idle`          | `30`                      | Seconds between polls when idle (5–3600)                                                                            |
| `notifications.enabled` | `true`                    | Terminal bell + OSC 9 + OS notification                                                                             |
| `notifications.bell`    | `true`                    | Ring the terminal bell                                                                                              |
| `notifications.on`      | `["failure","recovered"]` | Which transitions notify (`success` too)                                                                            |
| `github.host`           | `"github.com"`            | GitHub Enterprise host                                                                                              |
| `github.token_command`  | —                         | Shell command printing a token                                                                                      |
| `gitlab.host`           | `"gitlab.com"`            | Self-hosted GitLab host                                                                                             |
| `gitlab.token_command`  | —                         | Shell command printing a token                                                                                      |

Files tuiaux writes: logs in `$XDG_STATE_HOME/tuiaux/tuiaux.log` (`--debug` for verbose). Nothing else, and never tokens.
