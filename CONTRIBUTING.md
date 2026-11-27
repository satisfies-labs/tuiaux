# Contributing to tuiaux

Thanks for helping! This guide gets you from clone to pull request.

## Setup

```sh
git clone https://github.com/satisfies-labs/tuiaux && cd tuiaux
bun install          # Bun ≥ 1.3 (see .bun-version)
bun run dev          # the TUI, in the current repo (needs `gh` or `glab` logged in)
```

## Everyday commands

| Command                                       | What it does                                     |
| --------------------------------------------- | ------------------------------------------------ |
| `bun run check`                               | lint + typecheck + tests — run before every push |
| `bun test`                                    | tests (`tests/`)                                 |
| `bun run format`                              | fix lint and formatting (oxlint + oxfmt)         |
| `bun run compile`                             | standalone binary in `dist/`                     |

## Ground rules

- Read [docs/architecture.md](docs/architecture.md), the ADRs in [docs/adr/](docs/adr) and [AGENTS.md](AGENTS.md): layers only depend downwards (`domain` ← `platform` ← `providers` ← `monitor` ← `ui` ← `features`).
- TypeScript strict and Effect v4: services with layers, `Schema` for data, tagged errors as values. No `any`, no `as`. oxfmt decides formatting.
- Every provider mapping gets a test with a hand-written fixture in `tests/fixtures/`. No network in tests.
- UI changes get a `testRender` test over the fake app (`tests/support/app.tsx`); paste a `captureCharFrame()` before/after in the PR.
- Colors only come from theme tokens. Status colors are for statuses only. File names are kebab-case.

## Commits & releases

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, with an optional scope (`feat(gitlab): …`). [release-please](https://github.com/googleapis/release-please) turns them into the changelog, versions and GitHub releases; the same workflow (`.github/workflows/release.yml`) then builds the binaries and attaches them to the release.

## Adding a provider

See [docs/providers.md](docs/providers.md) — it's one folder, one interface and one fixture-based test.
