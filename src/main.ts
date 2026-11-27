#!/usr/bin/env bun
import { Console, Effect } from "effect"

/**
 * Entry point. The only module allowed to use Bun APIs (see docs/architecture.md).
 * Placeholder during the rebuild: answers --version / --help only; the TUI lands in step 6.
 */
import { BunRuntime } from "@effect/platform-bun"

import pkg from "../package.json"

const HELP = `tuiaux ${pkg.version} — your CI pipelines, live in your terminal

Usage: tuiaux [--help] [--version]`

const program = Effect.gen(function* () {
  const args = Bun.argv.slice(2)

  if (args.includes("--version") || args.includes("-v"))
    return yield* Console.log(pkg.version)

  if (args.includes("--help") || args.includes("-h"))
    return yield* Console.log(HELP)
  yield* Console.log("tuiaux is being rebuilt; the TUI is not available yet.")
})

BunRuntime.runMain(program)
