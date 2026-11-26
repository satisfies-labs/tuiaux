# CLAUDE.md — working on tuiaux

tuiaux is a TUI that shows GitHub Actions and GitLab CI pipelines live in the terminal. Bun + TypeScript (strict) + OpenTUI React. Linux and macOS.

## Commands

- `bun run check` — lint + typecheck + tests. **Must pass before you consider a task done.**
- `bun test` · `bun test tests/providers` — tests (no network, ever)
- `bun run demo` — run the TUI on fake data (no token)
- `bun run snapshot [dashboard|detail|watch] [cols] [rows]` — print a view as text; use it to check layout after UI changes
- `bun run format` — Biome autofix
- `bun run compile` — standalone binary in `dist/`

## Architecture (read docs/architecture.md)

Layers, imports only go downwards:
`core` (pure domain) ← `providers` (API adapters) ← `services` (http, auth, git, poller, notify, logger) ← `state` (store, selectors) ← `ui` (React views) ← `cli`.
`config` and `theme` are leaves.

Hard rules:

- `src/core` imports nothing outside `src/core`. No I/O there.
- UI never calls providers or `fetch`; it reads the store (`useStore`) and calls `poller.refreshNow()`.
- Providers never touch the store or the UI. All payload → domain mapping lives in `providers/<name>/map.ts` as pure functions.
- Colors only via theme tokens (`useTheme()`); status colors only for statuses (`toneOf(status)`). Never hardcode hex in `src/ui`.
- Never write to stdout/stderr while the TUI runs: use `logger` (file in `~/.local/state/tuiaux/`).
- Never store or log tokens.

## Conventions

- Files: kebab or lower camel for modules, PascalCase for React components. Named exports only.
- Strict TS, `noUncheckedIndexedAccess`: handle `undefined` instead of using `!`.
- New provider behaviour ⇒ fixture in `tests/fixtures/<provider>/` + test. New UI behaviour ⇒ test in `tests/ui/` using `testRender` + demo provider.
- Conventional Commits (`feat(gitlab): …`, `fix(ui): …`). One logical change per commit.
- Keep the layout on a strict character grid: pad/truncate with `truncate()` / `padEnd()`, set `wrapMode="none"` on table rows.

## OpenTUI notes

- `createCliRenderer()` + `createRoot(renderer).render(<App/>)`; hooks: `useKeyboard`, `useTerminalDimensions`, `useRenderer`.
- Intrinsics: `<box>` (flexbox, `border`, `borderStyle="rounded"`, `title`, `borderColor`), `<text>` with `<span fg bg>` / `<strong>` inside, `<scrollbox>`.
- OpenTUI is pre-1.0 and pinned in package.json: check `node_modules/@opentui/*/README.md` and `.d.ts` files instead of guessing APIs.
- Tests: `testRender(node, { width, height, kittyKeyboard: true })` → `renderOnce`, `captureCharFrame`, `mockInput`, `waitFor`.

## Design references

`docs/design/` — target layouts (`*.txt` grids + PNGs) and BRAND.md. The status dot is the brand: ● success · ◌/spinner running · ● failure · ○ idle.
