# Stay on Bun; tests with bun test

We run on Bun (runtime, package manager, `bun build --compile`) and test with `bun test` plus a small in-repo Effect helper. Users get a single binary with no runtime to install, and OpenTUI's primary runtime is Bun. OpenCode ships the same Effect v4 + OpenTUI + Bun combination in production.

## Considered options

- Node 26.4+ with pnpm: rejected. Users would need Node 26.4+, and the shebang would need `--experimental-ffi` for OpenTUI's native renderer. There would be no standalone binary, plus a JSX build step.
- Vitest with `@effect/vitest`: rejected. It runs on Node, so tests and the app would run on different runtimes.

## Consequences

`Bun.*` is used only in `src/main.ts`; everything else goes through Effect platform services so tests can swap them.
