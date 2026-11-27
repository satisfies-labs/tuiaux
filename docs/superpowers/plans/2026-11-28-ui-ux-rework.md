# UI/UX rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command registry driving keys, hints and a command palette; tabs per view; responsive tables; fixes B1–B6.

**Architecture:** Every view renders its body inside a `<Screen commands>` (ui) that merges the app's global commands (React context provided by `features/app`), runs the only `useKeyboard`, renders the status line, and renders the single open overlay (`overlayAtom`). Navigation is one atom (`view`, `history`, `lastRun`) with pure `go`/`back`. Lists use a generic `Table` whose column widths come from a pure `layoutColumns`.

**Tech Stack:** Bun, TypeScript strict, Effect v4 (`Data.TaggedEnum`, `Atom`), OpenTUI React 0.9.9 (`<input>` only), `@effect/atom-react`.

**Spec:** `docs/superpowers/specs/2026-11-28-ui-ux-rework-design.md`

## Global Constraints

- `bun run check` passes after every task.
- No `as`, no `!`, no hex in UI, colors only through `useTheme()`; status tones only for statuses (`toneOf`). Repo fetch errors keep using `theme.failure` as today.
- Every row `wrapMode="none"`, padded/truncated with `useText().fit` so no row exceeds its width.
- Files kebab-case, named exports, no comment banners. `features/<x>` never imports another feature except `features/app`.
- No new dependency; OpenTUI `<select>`/`<tab-select>` are not used.
- Commits: `type(scope): summary`, title only, no trailer.

## Review Focus

- Terminal narrower than 80 cols (e.g. 60): header, hints and tables must truncate, never wrap or overflow → test at 60×20 in Task 4.
- Typing `q`, `r`, `1` in the palette input must type, not quit/refresh/switch → test in Task 2.
- Palette with a query matching nothing: shows "No matches", ⏎ does nothing → test in Task 2.
- `2`/`3` before any run was opened: no-op, tab stays dimmed → test in Task 3.
- The selected run disappearing from the list while on the Run tab: existing "not in the recent list" message stays, `esc` goes back → kept by existing run-detail test, add `back` assertion in Task 3.

---

### Task 1: Command registry, Screen, overlays, fitting hints

**Files:**
- Create: `src/ui/commands.ts`, `src/ui/overlay.ts`, `src/ui/components/screen.tsx`, `src/ui/components/overlay-host.tsx`, `tests/ui/commands.test.ts`
- Modify: `src/ui/components/dialog.tsx`, `src/ui/components/key-hints.tsx`, `src/ui/components/index.ts`, `src/ui/index.ts`, `src/features/app/app.tsx`, `src/features/app/status-line.tsx` (moves into Screen; delete file), `src/features/app/help.tsx` (delete), `src/features/app/config-issues.tsx` (delete: becomes `Overlay.Notice`), `src/features/dashboard/dashboard.tsx`, `src/features/run-detail/run-detail.tsx`, `src/features/watch/watch.tsx`, tests in `tests/features/*.test.tsx`

**Interfaces (produced):**

```ts
// src/ui/commands.ts
export type CommandGroup = "Actions" | "Repos" | "Runs"
export interface Command {
  readonly id: string
  readonly title: string
  readonly group: CommandGroup
  readonly keys: ReadonlyArray<string>   // "j", "down", "return", "escape", "?", "ctrl+k"
  readonly hint?: string | undefined     // shown in the status line, in array order
  readonly palette?: boolean | undefined // default true
  readonly detail?: string | undefined   // right column in the palette (e.g. branch · age)
  readonly status?: Status | undefined   // dot shown in the palette for repos/runs
  readonly run: () => void
}
export const matchKey: (commands: ReadonlyArray<Command>, key: Pick<ParsedKey, "name" | "sequence" | "ctrl">) => Command | undefined
export const keyLabel: (key: string) => string            // "return"→"⏎", "escape"→"esc", "ctrl+k"→"^K", "down"→"↓", "up"→"↑"
export const GlobalCommandsContext: React.Context<ReadonlyArray<Command>>

// src/ui/overlay.ts
export type Overlay = Data.TaggedEnum<{
  Palette: {}
  Confirm: { readonly title: string; readonly message: string; readonly confirm: string; readonly run: () => void }
  Notice: { readonly title: string; readonly lines: ReadonlyArray<string> }
  Prompt: { readonly title: string; readonly initial: string; readonly submit: (value: string) => void }
}>
export const Overlay: …
export const overlayAtom: Atom.Writable<Overlay | undefined>
export const flashAtom: Atom.Writable<string | undefined>

// src/ui/components/screen.tsx
export const Screen: (props: { readonly commands: ReadonlyArray<Command>; readonly children: ReactNode }) => JSX.Element
// src/ui/components/dialog.tsx
export const Dialog: (props: { readonly title: string; readonly width: number; readonly footer?: ReadonlyArray<Hint>; readonly children: ReactNode }) => JSX.Element
// src/ui/components/key-hints.tsx
export const KeyHints: (props: { readonly hints: ReadonlyArray<Hint>; readonly width: number; readonly tail?: Hint }) => JSX.Element
```

Rules for `matchKey`: `"ctrl+x"` matches `key.ctrl && key.name === "x"`; any other string matches when `!key.ctrl` and (`key.name === k` or `key.sequence === k`). First command in array order wins.

`Screen`: column box, `flexGrow 1`. Commands = `[...props.commands, ...useContext(GlobalCommandsContext)]` (view commands win on conflicts). One `useKeyboard`: if `overlayAtom` is set, do nothing (the overlay owns keys); else run `matchKey(...)?.run()`. Status line (1 row, `surface` bg): `hostIssues` from `useMonitorState()` if any (existing text), else `flashAtom` if set, else `<KeyHints hints={commands with hint} tail={["^K","commands"]} width={width - 2}>`. A `useEffect` clears `flashAtom` 3000 ms after it changes. Renders `<OverlayHost commands={commands} />` last.

`KeyHints`: keeps hints in order while `key + " " + label + "  "` still fits `width - tailWidth`; tail always drawn right-aligned.

`Dialog`: absolute, centered: `left = floor((termWidth - w)/2)`, `top = max(1, floor(termHeight/4))`, `w = min(width, termWidth - 4)`; footer drawn with `KeyHints` inside.

`OverlayHost` (Palette lands in Task 2; render nothing for it here): Confirm → `y`/`⏎` runs + closes, `n`/`esc` closes; Notice → `esc`/`⏎` closes; Prompt → `<input focused>` prefilled, `⏎` submits + closes, `esc` closes. Each variant has its own `useKeyboard` only while mounted.

Migration (behaviour unchanged except hints):
- `features/app/app.tsx`: builds globals `quit` (`q`, `ctrl+c`, hint "quit"), `refresh` (`r`, hint "refresh", flashes "refreshing…"), `help` (`?`, hint none — opens `Overlay.Notice` listing commands until Task 2 replaces it with the palette). Provides `GlobalCommandsContext`. On mount, if `configIssues.length > 0`, sets `Overlay.Notice({ title: "config.toml", lines: [configPath, ...issues.map(i => "• " + describeIssue(i))] })`. `ctrl+c`/`q` must still quit while an overlay is open: App keeps a tiny `useKeyboard` for `ctrl+c` only.
- Dashboard/RunDetail/Watch: the `switch` blocks become `Command` arrays in the same file (same keys, same effects), returned as `<Screen commands={…}>`. `active` prop and `*_HINTS` exports go. Forget uses `Overlay.Confirm({ title: "forget repo", message: …, confirm: "forget", run })`; `forgetAtom` goes.

- [ ] **Step 1: failing tests** — `tests/ui/commands.test.ts`:
  - `matchKey` picks `"j"` for `{name:"j",sequence:"j",ctrl:false}`; `"down"` for name `down`; `"?"` for sequence `?`; `"ctrl+k"` only when `ctrl`; `"k"` does not match ctrl+k; first wins on duplicate keys.
  - `keyLabel("return") === "⏎"`, `keyLabel("ctrl+k") === "^K"`, `keyLabel("escape") === "esc"`.
  - `tests/features/app.test.tsx`: at 80×24 the last row contains `q quit`? No — contains `^K commands` and no row is longer than 80; `? `-help test now expects a Notice titled `keys` listing `quit` once (B1: assert `frame.split("esc").length` ≤ 2 inside the dialog and no React duplicate-key warning by spying `console.error`).
- [ ] **Step 2:** `bun test tests/ui/commands.test.ts tests/features` → fails (module missing).
- [ ] **Step 3:** implement as above; update existing feature tests only where they asserted removed hint text.
- [ ] **Step 4:** `bun run check` → green.
- [ ] **Step 5:** `git commit -m "refactor(ui): drive keys and hints from one command registry"`

### Task 2: Command palette

**Files:** Create `src/ui/fuzzy.ts`, `src/ui/components/command-palette.tsx`, `tests/ui/fuzzy.test.ts`, `tests/features/palette.test.tsx`; Modify `overlay-host.tsx`, `features/app/app.tsx`, `src/features/app/jump.ts` (create)

**Interfaces:**
- Consumes Task 1 `Command`, `Overlay.Palette`, `Dialog`.
- Produces `fuzzyScore(query: string, text: string): number | undefined` — case-insensitive subsequence; `undefined` when not a subsequence; `""` scores `0`. Score: +1 per matched char, +3 when the char starts a word (index 0 or after ` /-_.#`), +2 when contiguous with the previous match; minus `0.01 × text.length` as tie-breaker.
- Produces `jumpCommands(state: MonitorState, go: (repo: RepoKey) => void, open: (run: RunRef) => void): ReadonlyArray<Command>` in `features/app/jump.ts`: one `Repos` command per repo (`title` = path, `status` = latest run status, `detail` = `branch · age`), one `Runs` command per run of the 20 most recent runs across repos by `createdAt` (`title` = `workflow #n · repoName`, `detail` = status). `go` sets dashboard `selectionAtom` `{ panel: "repos", repo, run: undefined }` and navigates to Dashboard; `open` navigates to RunDetail.

Palette behaviour: `Dialog` titled `Commands`, width `min(72, termWidth - 8)`, list height `min(14, floor(termHeight × 0.6) - 4)`. Line 1: `› ` + `<input focused placeholder="Type a command, repo or run">`. Items = commands with `palette !== false`, filtered and sorted by `fuzzyScore(query, title)` (stable on ties; empty query keeps registry order), grouped by `group` in order Actions, Repos, Runs with a muted bold header per non-empty group. Action rows show `keyLabel(keys[0])` right-aligned; repo/run rows show `StatusDot` + `detail`. `↑`/`↓`/`ctrl+p`/`ctrl+n` move, `⏎` closes the palette then runs, `esc` closes. No items → muted `No matches`. Footer hints `↑↓ select`, `⏎ run`, `esc close`.

Globals added: `palette` (`ctrl+k`, `:`, `?`; status-line tail already shows `^K`), `about` (palette only, title `About tuiaux`, opens `Notice({ title: "tuiaux", lines: ["tuiaux v" + version, configPath] })`). The `help` Notice from Task 1 goes. Every command gets a palette-worthy `title` (e.g. `Open run details`, `Watch run`, `Open in browser`, `Forget repo`, `Refresh now`, `Quit`); `j/k/↑/↓/tab/h/l` get `palette: false`.

- [ ] **Step 1: failing tests** — `fuzzy.test.ts`: `fuzzyScore("ci","CI #412") > fuzzyScore("ci","pick it")`; `fuzzyScore("xyz","CI") === undefined`; `fuzzyScore("","x") === 0`; `fuzzyScore("ptf","portfolio")` defined. `palette.test.tsx`: `ctrl+k` opens `─ Commands ─`; typing `forg` shows `Forget repo` and not `Quit`; typing `q` then `r` types `qr` (app not quit, no `refresh` command recorded); typing `zzzz` shows `No matches` and `⏎` leaves it open; typing `web` ⏎ selects `acme/web` in the Repos panel; `?` opens the same palette; `About tuiaux` ⏎ shows `tuiaux v1.2.3`; `esc` closes.
- [ ] **Step 2:** run them → fail.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `bun run check` → green.
- [ ] **Step 5:** `git commit -m "feat(ui): add command palette"`

### Task 3: Navigation with history and a tabbed header

**Files:** Modify `src/ui/navigation.ts`, `src/features/app/header.tsx`, `src/features/app/app.tsx`, the three views; Create `src/ui/components/tabs.tsx`, `tests/ui/navigation.test.ts`

**Interfaces:**
```ts
export interface Navigation { readonly view: View; readonly history: ReadonlyArray<View>; readonly lastRun: RunRef | undefined }
export const go: (nav: Navigation, view: View) => Navigation    // pushes current (history capped at 10), sets lastRun for RunDetail/Watch; same view → unchanged
export const back: (nav: Navigation) => Navigation             // pops; empty history → Dashboard
export const navigationAtom: Atom.Writable<Navigation>         // keepAlive, replaces viewAtom
export const useNavigation: () => { readonly view: View; readonly lastRun: RunRef | undefined; readonly go: (v: View) => void; readonly back: () => void }
export const Tabs: (props: { readonly tabs: ReadonlyArray<{ readonly key: string; readonly label: string; readonly active: boolean; readonly enabled: boolean }> }) => JSX.Element
```
`Tabs` renders `` `${key} ${label}` `` separated by 3 spaces; active: `accent` + `<strong>` + `<u>`; disabled: `line`; else `muted`.

Header: `● tuiaux` then `Tabs` (`1 Dashboard`, `2 Run`, `3 Watch`; 2 and 3 enabled only with `lastRun`), right-aligned: one `hostKey` entry per distinct host among `state.repos` as `` `${kind} ` `` + dot (`failure` tone when a `hostIssues` entry matches, else `idle`), then `↻ ` + `formatAge(max fetchedAt)` (`—` when none). The version is not shown. When the row is too narrow, the right side drops first (width < tabs + right + 4).

Globals: `1`/`2`/`3` (`palette` titles `Go to dashboard` / `Go to run` / `Go to watch`, no hint), `]`/`[` next/previous enabled tab. View `esc`/`backspace` commands call `back()` (fixes B4). All `setView(...)` call sites use `go`.

- [ ] **Step 1: failing tests** — `navigation.test.ts`: `go` from Dashboard to RunDetail(r) sets `lastRun = r` and history `[Dashboard]`; `back` after Dashboard→RunDetail→Watch returns RunDetail; `back` on empty history gives Dashboard; history never exceeds 10. `app.test.tsx`: header shows `1 Dashboard` and not `v1.2.3`; `2` before any run opened leaves the Dashboard; after `⏎` on a run then `w`, `esc` shows the run detail, not the dashboard; in run detail for a run removed from state, `esc` returns to dashboard.
- [ ] **Step 2:** run → fail.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `bun run check` → green.
- [ ] **Step 5:** `git commit -m "feat(ui): add tabs and back navigation"`

### Task 4: Table component and responsive layout

**Files:** Create `src/ui/components/table.tsx`, `src/ui/columns.ts`, `tests/ui/columns.test.ts`; Modify `dashboard/repo-list.tsx`, `dashboard/runs-table.tsx`, `dashboard/jobs-panel.tsx`, `dashboard/dashboard.tsx`, `dashboard/model.ts`, `run-detail/job-list.tsx`, `run-detail/steps-panel.tsx`, `src/ui/components/panel.tsx`, `src/ui/components/status-dot.tsx`

**Interfaces:**
```ts
// src/ui/columns.ts
export interface ColumnSpec { readonly id: string; readonly width: number; readonly flex?: boolean; readonly min?: number; readonly priority: number } // higher priority survives longer
export const layoutColumns: (columns: ReadonlyArray<ColumnSpec>, width: number) => ReadonlyMap<string, number>
// src/ui/components/table.tsx
export interface Column<T> extends ColumnSpec { readonly header?: string; readonly align?: "left" | "right"; readonly render: (row: T) => { readonly text: string; readonly fg?: ThemeToken } | ReactNode }
export const Table: <T>(props: { readonly columns: ReadonlyArray<Column<T>>; readonly rows: ReadonlyArray<T>; readonly rowKey: (row: T) => string; readonly selected?: string; readonly focused: boolean; readonly width: number; readonly height: number; readonly header?: boolean; readonly lead?: (row: T) => ReactNode }) => JSX.Element
```
`layoutColumns`: gaps of 1 between kept columns. Drop the lowest-priority non-flex column while `sum(width) + gaps + (flex.min ?? 8)` > `width`; the flex column gets the rest; if still too wide, the flex column gets `max(0, rest)`. `Table` draws the `▌` marker (focused + selected) and `selection` bg, an optional `lead` (status dot) after the marker, then cells via `fit`, right-aligned with `padStart`. ReactNode cells (progress bar) get their computed width through `render`'s closure — callers read widths from `layoutColumns` themselves when needed.

`StatusDot` gains `now?: Date`: when given and status is `running`, glyph is `"◐◓◑◒"[floor(now.getTime() / 1000) % 4]`.

Layout decisions (spec §5.6):
- Runs columns/priorities: `workflow 10 p9`, `commit flex min 12 p10`, `time 8 p8 right`, `number 5 p6`, `age 4 p7 right`, `branch 10 p4`, `event 8 p2`. Fixes B3.
- Repo list: name column = repo name (`path` after last `/`) when every repo in its group shares one owner, else full path; branch `9 p4`, time `5 p8 right`. A failing repo shows `!` (`failure`) instead of the dot and its `describeError` in a merged `flex` cell (B6). Group header `GITHUB · 3`. Under 100 cols terminal width, branch column dropped by giving the panel width 28.
- Summary: omit zero counts (B5); append `  ·  filter: <query>` when a filter is set (Task 5).
- Jobs panel height = `clamp(jobs.length + 3, 5, floor(content / 2))`; runs table takes the rest. Run meta moves into the jobs panel title: `Jobs · CI #412 · a1b2c3d · push on main`.
- `Panel` gains `innerWidth` helper export `panelInner(width) = width - 4`; remove magic `width - 4 - …` arithmetic in features.

- [ ] **Step 1: failing tests** — `columns.test.ts`: at width 100 all runs columns kept; at 60 `event` and `branch` dropped, `time` kept with width 8; flex gets the remainder exactly (sum + gaps === width). Dashboard tests at 80×24 and 60×20: every frame line ≤ width, `13:05:11`-style time never cut (assert a full `h:mm:ss` or `m:ss` string present), `● 0 failed` absent, failing repo row contains `!` and `repo not found`, repo row shows `portfolio-2026` untruncated.
- [ ] **Step 2:** run → fail.
- [ ] **Step 3:** implement; migrate the five list renderers.
- [ ] **Step 4:** `bun run check` → green.
- [ ] **Step 5:** `git commit -m "feat(ui): add responsive table and rework dashboard layout"`

### Task 5: Filter, empty states, flash feedback

**Files:** Create `src/ui/components/empty-state.tsx`; Modify `dashboard/model.ts`, `dashboard/dashboard.tsx`, `run-detail/*`, `watch/watch.tsx`, tests.

**Interfaces:**
- `filterAtom: Atom.Writable<{ readonly query: string; readonly failingOnly: boolean }>` (keepAlive) in `dashboard/model.ts`; `applyFilter(repos: ReadonlyArray<RepoEntry>, filter): ReadonlyArray<RepoEntry>` — `fuzzyScore(query, path) !== undefined` and, if `failingOnly`, latest run tone `failure` or health `Failing`.
- `EmptyState: (props: { readonly title: string; readonly lines?: ReadonlyArray<string> }) => JSX.Element` — idle dot + `text` title, `muted` lines, one blank row of padding.

Dashboard commands: `/` (hint `filter`, title `Filter repos`) opens `Overlay.Prompt({ title: "filter repos", initial: query, submit })`; `f` (title `Show failing repos only` / `Show all repos`, hint none) toggles; `escape` in the dashboard clears an active filter (only present while one is set). Flash after `o` → `opened in browser`, forget → `forgot <path>`. Empty states replace the plain texts (no repos, no runs, filter matches nothing: `No repo matches "<query>"` + `esc clears the filter`). Watch: card vertically centered (`justifyContent="center"`), width `min(64, width - 2)`, job durations after names when the line fits.

- [ ] **Step 1: failing tests** — `/` then type `web` ⏎ → only `acme/web` listed and summary shows `filter: web`; `esc` → both repos back; `f` with one failing repo lists only it; `o` shows `opened in browser` in the last row; `applyFilter` unit cases in `tests/features/dashboard-model.test.ts`.
- [ ] **Step 2:** run → fail.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `bun run check` → green; update `docs/architecture.md` Keys table and UI section, `docs/roadmap.md` (tick filtering and quick jump).
- [ ] **Step 5:** `git commit -m "feat(dashboard): add repo filter and empty states"`
