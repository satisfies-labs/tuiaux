# Architecture

tuiaux is a TUI that shows GitHub Actions and GitLab CI pipelines live in the terminal. You type `tuiaux` anywhere and it opens.

Stack: **Bun** (runtime, package manager, `--compile` binaries) · **Effect v4** (services, errors, concurrency, Schema, atoms) · **OpenTUI React** + `@effect/atom-react` · TypeScript strict. Linux and macOS.

Vocabulary: see [`GLOSSARY.md`](../GLOSSARY.md). Decisions and their reasons: [`docs/adr/`](./adr).

## v1 scope

- One entry point: `tuiaux` opens the TUI. No subcommands, no headless/JSON mode, no demo mode.
- Views: **dashboard**, **run detail**, **watch**.
- Providers: **github.com** and **gitlab.com** only. Tokens come from the `gh` / `glab` CLIs only.
- Designed for v1.1, not implemented: job logs (streaming), rerun, cancel. The `Provider` interface and capabilities already have room for them.

## Source layout

```
src/
  main.ts            entry: --help/--version, builds the app layer, runs the program (only place using Bun APIs)
  domain/            Run, Job, Step, Status, Tone, refs, branded ids, ProviderError — Schema, pure, no I/O
  platform/          AppConfig, Logger(file), HttpLive (+ETag), Git, RepoHistory, RunCache, Opener
  providers/
    provider.ts      Provider + ProviderModule contracts, Capabilities
    registry.ts      `providers = { github, gitlab }` + the `Providers` service (lookup by kind, matchRemote)
    credentials.ts   token from a CLI, cached in memory, dropped when rejected
    rest.ts          shared REST client: auth, status → ProviderError, Schema decode; driven by a `RestSpec`
    github/          api.ts (payload schemas) · map.ts (pure) · index.ts (module: RestSpec + mapping)
    gitlab/          same shape
  monitor/           state.ts (immutable MonitorState/RepoEntry: policy + transitions) · poll.ts (generic poll loop) · repos.ts (startup repo set) · notification.ts (settled run → notification) · monitor.ts (service)
  features/
    app/             app.tsx (Root, App: view routing, global commands) · header (tabs, hosts) · jump (palette entries for repos and runs)
    dashboard/       model.ts (selection atoms, grouping, stats) · dashboard.tsx (layout, keys, focus) · repo-list · runs-table · jobs-panel
    run-detail/      model.ts (job selection, default job) · run-detail.tsx (breadcrumb, keys) · job-list · steps-panel
    watch/           watch.tsx (one run: status, overall progress, a dot per job; `w` from dashboard or detail)
  ui/                app-context (AppHandle: state atom, commands, open, quit) · navigation (View: Dashboard | RunDetail | Watch, navigationAtom with history) · commands (Command, matchKey) · overlay (palette, confirm, notice, prompt; flash) · columns (layoutColumns) · fuzzy · alert (bell, OSC 9, OpenTUI notification) · theme/ (palettes, resolve, useTheme) · components/ · describe (errors → text) · format (durations, ages) · text (fit, plural) · window (scrolling) · hooks (useNow)
tests/               mirrors src/; fixtures/<provider>/*.json (hand-written); fakes/ (fake Http, fake CLI spawner, …); support/ (Effect test helpers, builders)
```

### Import rules

```
features ──► ui ──► monitor ──► providers ──► platform ──► domain
   │                   ▲
   └───────────────────┘ (features read Monitor through atoms)
```

- `domain` imports only `effect`. No I/O.
- `providers/<x>` never imports another provider, `monitor` or `features`.
- `features/<x>` never imports another feature, except `features/app`, which routes the views (shared pieces go to `ui/`).
- File names are kebab-case, React components included (`status-dot.tsx`).
- UI code never calls a provider or HTTP: it reads atoms and calls `Monitor` commands.
- `Bun.*` is used only in `main.ts`. Everything else goes through Effect platform services (`FileSystem`, `Path`, child processes), so tests can swap them.

## Runtime: Effect owns everything

`main.ts` runs one Effect program:

1. Parse `--help` / `--version`.
2. Build the app `Layer`: config, logger, git, history, cache, providers, `Monitor`. Genuine startup failures happen here, **before** the terminal is touched.
3. Acquire the renderer as a scoped resource: `acquireRelease(createCliRenderer({ exitOnCtrlC: false }), destroy)`.
4. Mount React (`Root`) with an `AppHandle` made from **the already-built services**: `Atom.subscriptionRef(monitor.state)` for reading, Monitor commands run with `Effect.runForkWith(appContext)` so they keep the file logger. One `Monitor` instance is shared by the program and the UI.
5. Wait on a `quit` Deferred (`q`, `Ctrl-C`, SIGTERM).
6. Closing the scope interrupts every fiber, destroys the renderer and restores the terminal.

Defects (bugs) are caught at the top: restore the terminal, print one line with the log path, exit 70. Nothing writes to stdout/stderr while the TUI runs; the `Logger` writes to `~/.local/state/tuiaux/tuiaux.log`.

## Services

| Service | Responsibility |
|---|---|
| `Paths` | XDG locations (also on macOS), from `HOME` / `XDG_*` via Effect `Config`. Relative or empty XDG values are ignored. |
| `AppConfig` | Reads `~/.config/tuiaux/config.toml` once at startup (`effect/encoding/Toml` + Schema, each key decoded on its own). Missing file → create an empty one. Invalid keys or bad syntax → defaults for those keys + a list of `ConfigIssue`s shown in a dialog at startup. Never written by the app otherwise. |
| `FileLogger` | Replaces the console logger with a logfmt file logger (append, rotated to `.log.1` past 1 MB at startup). If the file can't be opened, logs are dropped, never printed. Level via `TUIAUX_LOG=Debug\|Info\|Warn\|Error`. Tokens are `Redacted` and can't be logged in clear. |
| `HttpLive` | The app's Effect `HttpClient` (fetch) + user agent + 15 s timeout + `withEtagCache` middleware (keyed by URL + query: `If-None-Match`, 304 → cached body as a 200). Base URL and auth are added by each provider's REST client. **No retries**: retry policy belongs to `Monitor`. |
| `Git` | `detect(cwd)` → root, current branch (None when detached), fetch remotes (`origin`, `upstream`, then others). Uses the git CLI with `GIT_OPTIONAL_LOCKS=0`. `parseGitUrl` (pure, drops credentials) is what providers' `matchRemote` build on; matching a remote to a provider happens in `providers`. |
| `RepoHistory` | Remembered repos in `~/.local/state/tuiaux/repos.json` (versioned): `RepoRef`, local path, last seen, last branch. Each change re-reads the file (two processes don't erase each other), writes are atomic (tmp + rename), a corrupt file is moved aside. `list` / `remember` / `forget`; never fails. |
| `RunCache` | Last known runs per repo in `~/.cache/tuiaux/runs/<encoded key>.json` (versioned), used to draw cold repos instantly. Missing/outdated/corrupt → None. Never fails. |
| Notifications | Not a service: `main.ts` subscribes to `Monitor.settled`, keeps what `notificationFor` (pure, `monitor/notification.ts`) wants per `notifications.on` (failure · recovered · success), and calls `ui/alert`: waits for `renderer.idle()`, then OpenTUI's notification (kitty, OSC 99) or OSC 9, then the bell. Text from CI APIs is stripped of control characters before it goes into a sequence. |
| `Opener` | Opens web pages with `open` (macOS) / `xdg-open`; only `https://` URLs, since they come from CI APIs. Never fails: problems are logged. |

## Providers

A provider is a self-contained module. Adding one (e.g. Bitbucket) = new folder + fixtures + one line in `registry.ts`; `domain` changes only the `ProviderKind` union, `monitor` and `features` don't change.

```ts
interface ProviderModule {
  readonly kind: ProviderKind                                   // "github" | "gitlab"
  readonly matchRemote: (remoteUrl: string) => Option<RepoRef>
  readonly make: Effect<Provider, never, HttpClient | ChildProcessSpawner>   // includes its own credential lookup
}

interface Provider {
  readonly kind: ProviderKind
  readonly capabilities: Capabilities                           // { rerun, cancel, logs: "stream" | "poll" | "none" }
  readonly listRuns: (repo: RepoRef, opts: ListRunsOpts) => Effect<ReadonlyArray<Run>, ProviderError>
  readonly listJobs: (run: RunRef) => Effect<ReadonlyArray<Job>, ProviderError>
  // v1.1: jobLog (Stream<LogChunk>), rerun, cancel — added with the capability that enables them
}
```

Several providers live side by side, so they're built by the `Providers` service (`registry.ts`) rather than each providing a `Provider` tag: `Providers.get(kind)` and `Providers.matchRemote(url)` (first provider that hosts the remote; `Git` can't do it, `platform` doesn't know providers).

- **Mapping** API payload → domain is pure (`map.ts`), payloads decoded with Schema.
- **Durations** of settled runs come from a reliable source, never from a list's `updated_at`: GitLab's GraphQL pipelines query returns real times, author and commit title in the same single request; GitHub's `…/timing` is fetched once per run revision with `cachedLookup`. Lookups never swallow host-wide errors (rate limit, credentials), so the `Monitor` still pauses the host.
- **Classification** HTTP response → `ProviderError` is written once in `rest.ts` (`matchStatus`): 401/403 → `Unauthorized` (token dropped), 429 → `RateLimited`, 404 → `NotFound`, else `Unexpected` (error body as cause). What differs per API is declared in its `RestSpec`: the reset header, whether a 403 can mean a spent quota (GitHub), the CLI and hints.
- **Credentials** are per provider: GitHub runs `gh auth token --hostname github.com`, GitLab runs `glab config get token --host gitlab.com`. A missing CLI gives `AuthMissing(cli-not-installed)`, a non-zero exit or empty output `AuthMissing(not-logged-in)`. Both use `Authorization: Bearer` (redacted by Effect). Read once through an Effect `Cache` (concurrent callers share one CLI call, failures are not kept); dropped on `Unauthorized` and re-read on manual refresh. The provider writes the user-facing hint (`AuthMissing.hint`).
- Assumption: the CI is the code host. CI services building repos hosted elsewhere (CircleCI, Buildkite) are out of scope.

## Domain

- Entities are `Schema.Class` (`Run`, `Job`, `Step`) → structural equality: an unchanged poll result doesn't change state or re-render.
- Branded ids (`RunId`, `JobId`, `RepoKey`) and refs (`RepoRef`, `RunRef`, `JobRef`).
- `Status`: `success · failure · running · queued · cancelled · skipped · idle`, folded by `toneOf` into 4 tones `success · running · failure · idle`.
- `elapsed(item, now)`: start → now while active, else `duration(item)` (start → finish, None without an end, e.g. a skipped step).
- Common model only; missing data is optional. `Job.stage?` carries GitLab stages.

### Errors

```
ProviderError = AuthMissing  { kind, host, reason: "cli-not-installed" | "not-logged-in", hint }   host-wide
              | Unauthorized { kind, host, hint }                                                 host-wide
              | RateLimited  { kind, host, resetAt }                                              host-wide
              | NotFound     { repo, resource: "repo" | "run" | "job" }
              | Network      { kind, host, cause }
              | Unexpected   { kind, host, status?, cause }   // 5xx, unexpected status, undecodable payload
```

All are `Schema.TaggedError`s: yieldable, structurally equal (a repeated error doesn't change state). `NotFound` on a run or job doesn't stop the repo, only `resource: "repo"` does.

Errors are kept as values (`RepoHealth = Ok | Failing { error, since, nextRetryAt }`) and turned into text at render time by `describe(error)`.

## Monitor

The only stateful engine. It keeps an up-to-date picture of CI for the repos on screen and announces changes. It doesn't touch HTTP (providers do), doesn't notify (subscribers do), and knows nothing about views.

```ts
interface Monitor {
  readonly state: SubscriptionRef<MonitorState>  // repos → runs, health, lastFetchedAt, stale; jobs of the focused run; host issues
  readonly focusRepo: (repo: RepoRef | undefined) => Effect<void>   // cursor on a repo → hot
  readonly focusRun: (run: RunRef | undefined) => Effect<void>      // polls jobs of that run
  readonly refresh: Effect<void>                               // `r`: poll now (repos and open run's jobs), retry stopped hosts
  readonly forget: (repo: RepoRef) => Effect<void>             // `d`
  readonly settled: Stream<RunSettled>                         // running/queued → final
}
```

### Repo set

- In a git repo with a supported remote: the **current repo** pinned first, then **remembered repos**.
- Outside a git repo: remembered repos + the notice "You are currently not in a Git repo."
- Nothing remembered: empty state.
- A repo becomes remembered the first time a poll returns at least one run.

### Polling policy (hot / cold)

- **Hot** = current repo, repo under the cursor, or any repo with an active run (including one whose *cached* status is active). Polled every `refresh.active` s while something runs, `refresh.idle` s otherwise.
- **Cold** = everything else: drawn from `RunCache`, marked stale (`updated 3d ago`), not polled.
- One fiber per hot repo (`FiberMap` keyed by `RepoKey`), reconciled by one fiber on `SubscriptionRef.changes` that reads the latest state (`MonitorState.hotRepos`). Repos and jobs share one `poll` loop: each fetch says "again in X" or "stop". Jobs polled only for the focused run (`FiberHandle`); settled runs' jobs fetched once.
- `RunSettled` compares with this session's data only: runs that settled while tuiaux was closed don't announce. Side effects of a fetch (cache, history, `settled`) happen before the state update, uninterruptibly, since that update may make the repo cold.

### Reaction to errors

| Error | Reaction |
|---|---|
| `Network`, `Unexpected` | Exponential backoff for that repo, 10 s → 5 min |
| `RateLimited` | Pause every repo on that host until `resetAt` |
| `AuthMissing`, `Unauthorized` | Stop that host until manual refresh |
| `NotFound` | Stop that repo; it stays listed with the error |

Per-repo errors show inline on the row; host-wide errors show in the bottom status line.

## UI

- `@effect/atom-react`: atoms adapt `Monitor.state` for components and call `Monitor` commands. UI-only state (view, cursor, panel focus, dialogs) lives in plain atoms.
- Colors only via theme tokens; status colors only for statuses (`toneOf`). Strict character grid (`truncate`/`padEnd`, `wrapMode="none"` on rows).
- Commands: every action is a `Command` (title, keys, hint, run) declared once. Each view renders `<Screen commands>`, which merges the app's global commands, runs the only key dispatcher, draws the status line from the hints and hosts the open overlay. The palette (`Ctrl-K`, `:`, `?`) lists the same commands plus jumps to repos and recent runs.
- One overlay at a time (`overlayAtom`); while open it owns the keys, `esc` closes it. `Ctrl-C` always quits.
- Lists use `Table`: columns sized by `layoutColumns`, the lowest priorities dropped first when the terminal is narrow.
- Theme: 11 tokens (`bg surface selection line text muted accent success running failure idle`), built-in themes, default `terminal` theme resolved from the terminal palette (OSC 4/10/11) with `tuiaux-dark` fallback.

### Keys

| Key | Action |
|---|---|
| `↑↓` / `jk` | move cursor |
| `Tab` / `←→` / `hl` | switch panel |
| `Enter` | open run detail |
| `w` | watch selected run |
| `Esc` / `Backspace` | back (dashboard: clear the filter) |
| `o` | open in browser |
| `r` | refresh now (also retries stopped hosts) |
| `d` | forget repo (confirmation) |
| `/` | filter repos by name |
| `f` | show failing repos only |
| `1` `2` `3` / `[` `]` | tabs: dashboard, last run, its watch view |
| `Ctrl-K` / `:` / `?` | command palette |
| `q` / `Ctrl-C` | quit |

Keys for capabilities a provider lacks are hidden.

## Configuration (`~/.config/tuiaux/config.toml`)

```toml
[theme]
name = "terminal"
[theme.colors]          # optional "#rrggbb" | "default" | "ansi:0..15"

[refresh]
active = 5              # s, 2..300
idle = 30               # s, 5..3600

[notifications]
enabled = true
bell = true
on = ["failure", "recovered"]   # + "success"
```

Settings only: no repos, no hosts, no tokens. Read once at startup.

## Files

| Path | Owner |
|---|---|
| `~/.config/tuiaux/config.toml` | user |
| `~/.local/state/tuiaux/repos.json` | app (`RepoHistory`) |
| `~/.local/state/tuiaux/tuiaux.log` | app (`Logger`) |
| `~/.cache/tuiaux/runs/*.json` | app (`RunCache`), disposable |

XDG variables are honoured. Tokens are never written anywhere.

## Testing

`bun test` with a small in-repo helper (`it.effect`-style: runs an Effect with test layers and `TestClock`). No network, ever.

| Target | How |
|---|---|
| `domain` | plain unit tests |
| `providers` | hand-written JSON fixtures + fake `HttpClient`: payload mapping and HTTP → error classification |
| `platform` | config fallbacks; `RepoHistory`/`RunCache` on a temp dir, atomic writes |
| `monitor` | `FakeProvider` + `TestClock`: hot/cold, backoff, host pause/stop, `RunSettled` |
| `features` | `testRender` with the real app layer over fakes; assert char frames, drive with mock keys |

## Distribution

`bun build --compile` standalone binaries per OS/arch (built natively on each OS in CI). npm wrapper / Homebrew later.
