# Contributing to tuiaux

Thanks for helping! This guide gets you from clone to pull request.

## Setup

```sh
git clone https://github.com/satisfies-labs/tuiaux && cd tuiaux
bun install          # Bun ≥ 1.3 (see .bun-version)
bun run demo         # the TUI with fake data, no token needed
bun run dev          # the real thing, in the current repo
```

## Everyday commands

| Command                                       | What it does                                     |
| --------------------------------------------- | ------------------------------------------------ |
| `bun run check`                               | lint + typecheck + tests — run before every push |
| `bun test`                                    | tests (`tests/`)                                 |
| `bun run snapshot [dashboard\|detail\|watch]` | render a view to plain text with demo data       |
| `bun run format`                              | fix lint and formatting (oxlint + oxfmt)         |
| `bun run compile`                             | standalone binary in `dist/`                     |

## Ground rules

- Read [docs/architecture.md](docs/architecture.md): layers only depend downwards (`core` ← `providers` ← `services` ← `state` ← `ui` ← `cli`).
- TypeScript strict, no `any`. oxfmt decides formatting.
- Every provider mapping gets a test with a recorded API fixture in `tests/fixtures/`. No network in tests.
- UI changes: paste the before/after `bun run snapshot` output in the PR.
- Colors only come from theme tokens. Status colors are for statuses only.

## Commits & releases

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, with an optional scope (`feat(gitlab): …`). [release-please](https://github.com/googleapis/release-please) turns them into the changelog, versions and GitHub releases; the release workflow then builds the binaries and publishes to npm.

## Adding a provider

See [docs/providers.md](docs/providers.md) — it's one folder, one interface and one fixture-based test.
