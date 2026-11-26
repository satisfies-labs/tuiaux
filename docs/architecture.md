# Architecture

tuiaux is a single Bun + TypeScript package organised in layers. **A layer only imports from the layers below it.**

```
cli ─────────► ui ─────────► state ─────► services ─────► providers ─────► core
(args, cmds)   (React views)  (store,      (poller, http,   (github, gitlab,  (types, status,
                              selectors)   auth, git,       demo)             time — pure)
                                           notify, logger)
                    config (zod + TOML) and theme (tokens) are leaves used by the layers above
```

| Folder          | Role                                                                                                      | May import                          |
| --------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `src/core`      | Domain model (`Run`, `Job`, `Status`, `Tone`), status logic, formatting. Pure, no I/O.                    | nothing                             |
| `src/providers` | One adapter per CI, implementing `Provider` (`types.ts`). Maps API payloads to `core`.                    | core, services/http                 |
| `src/services`  | Side effects: HTTP with ETag cache, token resolution, git remote detection, polling, notifications, logs. | core, providers, config, state      |
| `src/state`     | Tiny external store (`store.ts`) + derived view-model (`selectors.ts`).                                   | core                                |
| `src/config`    | Paths (XDG), zod schema, TOML loading with readable errors.                                               | —                                   |
| `src/theme`     | Built-in themes, token resolution (`ansi:N` → detected terminal palette).                                 | config (types)                      |
| `src/ui`        | OpenTUI React: `App`, `views/`, `components/`, hooks. Reads the store, never calls an API.                | everything above, never `providers` |
| `src/cli`       | Argument parsing, commands (`dashboard`, `watch`, `status`, `themes`, `config`), process exit codes.      | everything                          |

## Data flow

```
          ┌──────────── Poller (services/poller.ts) ────────────┐
 timer ──►│ for each target (4 at a time):                       │
          │   registry.for(repo) → Provider.listRuns()           │──► store.set({ repos })
          │ for the selected run: Provider.listJobs()            │──► store.set({ jobs })
          │ detect running → settled transitions                 │──► notifyRun()
          └──────────────────────────────────────────────────────┘
                                   │
                         useStore(store, selector)
                                   ▼
                     App → viewModel(state) → Dashboard / RunDetail / Watch
                                   │
                         useKeyboard → store.set({ focus, selection, view }) / poller.refreshNow()
```

- **Polling pace**: `refresh.active` seconds while any run is running or queued, `refresh.idle` otherwise. Errors back off per repo (10 s → 5 min). Settled runs' jobs are fetched once.
- **Rate limits**: every GET is conditional (`If-None-Match`); `304` replies reuse the cached body and don't count against GitHub's quota.
- **Auth**: `ProviderRegistry` builds one provider per `(provider, host)` lazily and resolves the token on first use, so a missing token only affects the repos of that host.

## Status model

Providers fold their native states into `Status` (`success · failure · running · queued · cancelled · skipped · idle`). The UI only knows four **tones** — `success`, `running`, `failure`, `idle` — mapped by `toneOf()`. Tones are the theme's status tokens and the color of the brand's dot.

## Theming

Themes are specs of 11 tokens (`bg surface selection line text muted accent success running failure idle`). A value is `#rrggbb`, `default` or `ansi:N`. The default `terminal` theme is all `default`/`ansi:N`; at startup the renderer queries the terminal palette (OSC 4/10/11, `renderer.getPalette()`), and unresolved values fall back to `tuiaux-dark`.

## Testing strategy

- `core`, `config`, `theme`: plain unit tests.
- Providers: recorded JSON fixtures + a fake `HttpClient`. No network.
- UI: `@opentui/react/test-utils` renders the real `App` headlessly with the demo provider; tests assert on the character frame and drive it with mock keys.
- `bun run snapshot` prints frames for visual review in PRs.

## Distribution

- `bun run build` → `dist/cli.js` for npm (dependencies stay external; OpenTUI installs its native package per platform).
- `bun run compile` → standalone binary. Only the native OpenTUI package of the target platform is bundled (others are marked external), so release binaries are built natively on each OS in CI.
