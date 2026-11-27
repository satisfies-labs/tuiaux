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
  platform/          AppConfig, Logger(file), Http(+ETag), Git, RepoHistory, RunCache, Notifier, Opener, Theme
  providers/
    Provider.ts      Provider + ProviderModule contracts, Capabilities
    registry.ts      export const providers = [GitHub, GitLab]
    github/          api schemas · map.ts (pure) · credentials (gh) · classify (HTTP → ProviderError) · layer
    gitlab/          same shape (glab)
  monitor/           Monitor service: polling policy, state, settled events
  features/
    app/             root component, view routing, global keys, status line, dialogs
    dashboard/       atoms.ts · Dashboard.tsx · keys.ts
    run-detail/
    watch/
  ui/                shared components (StatusDot, Panel, KeyHints, ProgressBar, Dialog) + theme hook
tests/               mirrors src/; fixtures/<provider>/*.json (hand-written); fakes/ (FakeProvider, FakeGit, …)
```

### Import rules

```
features ──► ui ──► monitor ──► providers ──► platform ──► domain
   │                   ▲
   └───────────────────┘ (features read Monitor through atoms)
```

- `domain` imports only `effect`. No I/O.
- `providers/<x>` never imports another provider, `monitor` or `features`.
- `features/<x>` never imports another feature (shared pieces go to `ui/` or `features/app`).
- UI code never calls a provider or HTTP: it reads atoms and calls `Monitor` commands.
- `Bun.*` is used only in `main.ts`. Everything else goes through Effect platform services (`FileSystem`, `Path`, child processes), so tests can swap them.

## Runtime: Effect owns everything

`main.ts` runs one Effect program:

1. Parse `--help` / `--version`.
2. Build the app `Layer`: config, logger, git, history, cache, providers, `Monitor`. Genuine startup failures happen here, **before** the terminal is touched.
3. Acquire the renderer as a scoped resource: `acquireRelease(createCliRenderer({ exitOnCtrlC: false }), destroy)`.
4. Mount React with an atom runtime built from **the already-built services** (one `Monitor` instance shared by the program and the UI).
5. Wait on a `quit` Deferred (`q`, `Ctrl-C`, SIGTERM).
6. Closing the scope interrupts every fiber, destroys the renderer and restores the terminal.

Defects (bugs) are caught at the top: restore the terminal, print one line with the log path, exit 70. Nothing writes to stdout/stderr while the TUI runs; the `Logger` writes to `~/.local/state/tuiaux/tuiaux.log`.

## Services

| Service | Responsibility |
|---|---|
| `AppConfig` | Reads `~/.config/tuiaux/config.toml` once at startup (Schema + TOML). Missing file → create an empty one. Invalid keys or bad syntax → defaults for those keys + a list of `ConfigIssue`s shown in a dialog at startup. Never written by the app otherwise. |
| `Logger` | Effect Logger to a file. Tokens are `Redacted` and can't be logged in clear. |
| `Http` | Effect `HttpClient` (fetch): base URL, auth header, user agent, 15 s timeout, in-memory ETag cache (`If-None-Match`, 304 → cached body). **No retries**: retry policy belongs to `Monitor`. |
| `Git` | Finds the repo for the cwd and its remotes/current branch. Asks every registered provider's `matchRemote`. |
| `RepoHistory` | Remembered repos in `~/.local/state/tuiaux/repos.json`: `RepoRef`, local path, last seen, last branch. Atomic writes (tmp + rename). `forget(repo)`. |
| `RunCache` | Last known runs per repo in `~/.cache/tuiaux/runs/<key>.json`, used to draw cold repos instantly. Safe to delete. |
| `Notifier` | Bell / OSC 9 / OS notification on `RunSettled`, filtered by config. |
| `Opener` | Opens URLs in the browser. |

## Providers

A provider is a self-contained module. Adding one (e.g. Bitbucket) = new folder + fixtures + one line in `registry.ts`; `domain` changes only the `ProviderKind` union, `monitor` and `features` don't change.

```ts
interface ProviderModule {
  readonly kind: ProviderKind                                   // "github" | "gitlab"
  readonly matchRemote: (remoteUrl: string) => RepoRef | undefined
  readonly capabilities: Capabilities                           // { rerun, cancel, logs: "stream" | "poll" | "none" }
  readonly layer: Layer<Provider, never, HttpClient | …>        // includes its own credential lookup
}

interface Provider {
  readonly listRuns: (repo: RepoRef, opts: ListRunsOpts) => Effect<ReadonlyArray<Run>, ProviderError>
  readonly listJobs: (run: RunRef) => Effect<ReadonlyArray<Job>, ProviderError>
  readonly jobLog:   (job: JobRef) => Stream<LogChunk, ProviderError>   // v1.1
  readonly rerun:    (run: RunRef) => Effect<void, ProviderError>       // v1.1
  readonly cancel:   (run: RunRef) => Effect<void, ProviderError>       // v1.1
}
```

- **Mapping** API payload → domain is pure (`map.ts`), payloads decoded with Schema.
- **Classification** HTTP response → `ProviderError` is per provider (`classify.ts`): each API has its own rate-limit headers.
- **Credentials** are per provider: GitHub runs `gh auth token --hostname github.com`, GitLab asks `glab`. Fetched once, cached; dropped on `Unauthorized` and re-read on manual refresh. The provider writes the user-facing hint (`AuthMissing.hint`).
- Assumption: the CI is the code host. CI services building repos hosted elsewhere (CircleCI, Buildkite) are out of scope.

## Domain

- Entities are `Schema.Class` (`Run`, `Job`, `Step`) → structural equality: an unchanged poll result doesn't change state or re-render.
- Branded ids (`RunId`, `JobId`, `RepoKey`) and refs (`RepoRef`, `RunRef`, `JobRef`).
- `Status`: `success · failure · running · queued · cancelled · skipped · idle`, folded by `toneOf` into 4 tones `success · running · failure · idle`.
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
  readonly focusRepo: (repo: RepoRef | null) => Effect<void>   // cursor on a repo → hot
  readonly focusRun: (run: RunRef | null) => Effect<void>      // polls jobs of that run
  readonly refresh: Effect<void>                               // `r`: poll now, retry stopped hosts
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
- One fiber per hot repo (`FiberMap` keyed by `RepoKey`); jobs polled only for the focused run; settled runs' jobs fetched once.

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
- Theme: 11 tokens (`bg surface selection line text muted accent success running failure idle`), built-in themes, default `terminal` theme resolved from the terminal palette (OSC 4/10/11) with `tuiaux-dark` fallback.

### Keys

| Key | Action |
|---|---|
| `↑↓` / `jk` | move cursor |
| `Tab` / `←→` / `hl` | switch panel |
| `Enter` | open run detail |
| `w` | watch selected run |
| `Esc` / `Backspace` | back |
| `o` | open in browser |
| `r` | refresh now (also retries stopped hosts) |
| `d` | forget repo (confirmation) |
| `?` | help |
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
