# anti-slop (vendored)

Oxlint JS plugins copied into this repo. tuiaux owns these files; upstream changes are pulled in by hand
(see the `install-anti-slop` skill, `references/update.md`).

- Source: https://github.com/dmmulroy/anti-slop
- Commit: `63dbb09f73438e550a6991dc6d778f979ffbf183` (2026-11-20, "docs: recommend cloudflare/oxlint-config over anti-slop")
- Copied from: `skills/install-anti-slop/assets/anti-slop/` at that commit, via the skill's `scripts/install.mjs`.
  Verified byte-identical to a fresh checkout of the commit on 2026-11-27.
- Installed paths:
  - `tools/oxlint/anti-slop/index.ts` — generic plugin `anti-slop`
  - `tools/oxlint/anti-slop/effect/index.ts` — opt-in plugin `anti-slop-effect` (enabled: `effect` is a direct dependency)
  - `tools/oxlint/anti-slop/vendor/eslint-stylistic/` — vendored rule with its own `LICENSE` and `UPSTREAM.md`
- Runtime dependency: `@oxlint/plugins`, pinned to the exact `oxlint` version (both bump together).
- Registered in `.oxlintrc.json` (the first lint pass, not the `@effect/tsgo` pass). Every rule is at `"error"`,
  plus the native companion rule `oxc/no-accumulating-spread`.

## Deviations from upstream

None. The rule tests (`*.test.ts`) aren't part of the skill's assets, so they aren't vendored.

## Known limitations

- `anti-slop-effect/no-service-constructor-imports` only checks relative imports; package-alias imports aren't enforced.
