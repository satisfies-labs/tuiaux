/**
 * Build a standalone `tuiaux` binary for the current platform (or a given Bun target).
 *   bun run compile                 → dist/tuiaux
 *   bun run compile bun-linux-arm64 → dist/tuiaux-linux-arm64
 * Release CI runs this natively on each OS (OpenTUI ships a native library per platform).
 */
const target = Bun.argv[2];

// OpenTUI loads its native library from one package per platform. Bundle only the one we
// build for and mark the others external, otherwise the bundler tries to resolve them all.
const NATIVE = [
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-arm64-musl",
  "linux-x64",
  "linux-x64-musl",
  "win32-arm64",
  "win32-x64",
];
const platform = target
  ? target.replace(/^bun-/, "").replace(/-(baseline|modern)$/, "")
  : `${process.platform}-${process.arch}`;
const externalNative = NATIVE.filter((p) => p !== platform).map((p) => `@opentui/core-${p}`);
const suffix = target ? `-${target.replace(/^bun-/, "")}` : "";
const outfile = `dist/tuiaux${suffix}`;

const result = await Bun.build({
  entrypoints: ["src/main.ts"],
  compile: target ? { target: target as Bun.Build.CompileTarget, outfile } : { outfile },
  minify: true,
  external: externalNative,
  sourcemap: "linked",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
console.log(`built ${outfile}`);
