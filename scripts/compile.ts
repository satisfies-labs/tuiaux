/**
 * Build a standalone `tuiaux` binary for the current platform (or a given Bun target).
 *   bun run compile                 → dist/tuiaux
 *   bun run compile bun-linux-arm64 → dist/tuiaux-linux-arm64
 * Release CI runs this natively on each OS (OpenTUI ships a native library per platform).
 */
const isCompileTarget = (value: string): value is Bun.Build.CompileTarget =>
  /^bun-(darwin|linux|windows)-(x64|arm64)(-(baseline|modern))?(-(glibc|musl))?$/.test(
    value,
  )

const arg = Bun.argv[2]

if (arg !== undefined && !isCompileTarget(arg)) {
  console.error(`unknown target ${arg} (e.g. bun-linux-arm64, bun-darwin-x64)`)
  process.exit(2)
}

const target = arg

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
]

const platform = target
  ? target.replace(/^bun-/, "").replace(/-(baseline|modern)$/, "")
  : `${process.platform}-${process.arch}`

const externalNative = NATIVE.flatMap(p =>
  p === platform ? [] : [`@opentui/core-${p}`],
)

const suffix = target ? `-${target.replace(/^bun-/, "")}` : ""
const outfile = `dist/tuiaux${suffix}`

const result = await Bun.build({
  entrypoints: ["src/main.ts"],
  compile: target ? { target, outfile } : { outfile },
  minify: true,
  external: externalNative,
  sourcemap: "linked",
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log(`built ${outfile}`)
