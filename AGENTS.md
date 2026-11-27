# AGENTS.md — working on tuiaux

tuiaux is a TUI that shows GitHub Actions and GitLab CI pipelines live in the terminal: type `tuiaux` anywhere and it opens. Bun + TypeScript (strict) + **Effect v4** + OpenTUI React (`@effect/atom-react`). Linux and macOS.

> The app is being rebuilt from scratch on this architecture. The design is in `docs/architecture.md`, decisions in `docs/adr/`, vocabulary in `GLOSSARY.md`. When old code disagrees with these docs, the docs win.

## Commands

- `bun run check` — lint (oxlint, then the type-aware Effect rules of `@effect/tsgo` with `--deny-warnings`, then `oxfmt --check`) + typecheck + tests. **Must pass before you consider a task done.**
- `bun test` — tests (no network, ever)
- `bun run dev` — run the TUI
- `bun run format` — oxfmt (no semicolons, 80 columns, `x => …`). `bunx oxlint --fix src tests scripts` fixes import member order.
- `bun install` runs `prepare`, which patches oxlint with the Effect rules; `lint` re-applies it. Bumping `oxlint`, `oxlint-tsgolint` or `@effect/tsgo` must keep them in the versions `@effect/tsgo` supports (see its README).
- `bun run compile` — standalone binary in `dist/`

## Architecture (read docs/architecture.md)

`src/`: `domain` ← `platform` ← `providers` ← `monitor` ← `ui` ← `features`, plus `main.ts`.

Hard rules:

- `src/domain` imports only `effect`. No I/O.
- **Effect owns the runtime.** `main.ts` builds the layers, acquires the renderer as a scoped resource and waits on `quit`. Don't let React own lifecycles or create services.
- **`Bun.*` only in `src/main.ts`.** Everywhere else use Effect platform services (`FileSystem`, `Path`, child processes) so tests can swap them.
- UI never calls providers or HTTP: it reads atoms over `Monitor.state` and calls `Monitor` commands. UI-only state lives in plain atoms.
- Providers are self-contained (`matchRemote`, credentials, `classify`, `map`, `capabilities`); payload → domain mapping is pure in `providers/<name>/map.ts`. A provider never imports another provider, `monitor` or `features`. A feature never imports another feature.
- Expected failures are tagged errors in the error channel (`ProviderError`); keep them as values in state and format them at render time with `describe()`. No `throw`, no stringly errors.
- No retries outside `Monitor`.
- Colors only via theme tokens (`useTheme()`); status colors only for statuses (`toneOf(status)`). Never hardcode hex in UI code.
- Never write to stdout/stderr while the TUI runs: use the Effect `Logger` (file in `~/.local/state/tuiaux/`).
- Tokens are `Redacted`, never stored, never logged. They come only from `gh` / `glab`.
- The app never writes `config.toml` (except creating it empty when missing).

## Effect conventions

- Services are Effect services with a `Layer`; dependencies are yielded once when the layer is built. Methods return `Effect`/`Stream` and are named with `Effect.fn("Service.method")`.
- Domain types and API payloads use `Schema` (no zod). Entities are `Schema.Class`; ids are branded.
- Every `Schema.Class` / `TaggedClass` / `TaggedError` is branded: `Schema.Class<Run, { readonly brand: unique symbol }>("Run")({…})`. Otherwise a plain object with the same fields typechecks as a `Run` but has no structural equality.
- No type assertions (`as`): use `satisfies`, annotations, type guards, or a Schema decoder. Decode with the typed API (`decodeEffect`, `decodeOption`) when the input type is known; `decodeUnknown*` only for real `unknown` input.
- No `unknown`/`any` in an Effect's error or requirements channel: name the error type, or make the helper generic.
- In domain and persisted schemas, never `Schema.optional`: use a required `Schema.UndefinedOr(X)`. `{ a: undefined }` and `{}` aren't structurally equal, so a value must have exactly one shape (otherwise identical polls look different and the cache round trip changes values). Constructors then list every field.
- Run processes with `runCommand` (`src/platform/command.ts`), not `ChildProcessSpawner.string`, which ignores the exit code.
- Services that only read/write app-owned files (`RepoHistory`, `RunCache`, `Git`) never fail: they log and degrade. Their error channel is `never`.
- Effect v4 is new: check `node_modules/effect` sources and `.d.ts` files instead of relying on memory or v3 examples.

## Conventions

- Strict TS, `noUncheckedIndexedAccess`: handle `undefined` instead of using `!`.
- Files: kebab-case everywhere, React components included (`status-dot.tsx`). Components themselves stay PascalCase. Named exports only.
- New provider behaviour ⇒ hand-written fixture in `tests/fixtures/<provider>/` + test. Monitor behaviour ⇒ test with `FakeProvider` + `TestClock`. New UI behaviour ⇒ `testRender` test over fake layers. Fakes live only in `tests/`.
- Use the vocabulary of `GLOSSARY.md` in code and docs.
- Conventional Commits (`feat(gitlab): …`, `fix(ui): …`). One logical change per commit.
- Keep the layout on a strict character grid: pad/truncate with `truncate()` / `padEnd()`, set `wrapMode="none"` on table rows.

## OpenTUI notes

- Pre-1.0 and pinned in package.json: check `node_modules/@opentui/*/README.md` and `.d.ts` files instead of guessing APIs.
- Create the renderer with `exitOnCtrlC: false`; `q`/`Ctrl-C` complete the app's `quit` Deferred.
- Tests: `testRender(node, { width, height, kittyKeyboard: true })` → `renderOnce`, `captureCharFrame`, `mockInput`, `waitFor`.

## Design references

`docs/design/` — target layouts (`*.txt` grids + PNGs) and BRAND.md. The status dot is the brand: ● success · ◌/spinner running · ● failure · ○ idle.
