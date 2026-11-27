#!/usr/bin/env bun
import { Cause, Console, Deferred, Effect, Exit, Layer, Option } from "effect"
import { Atom } from "effect/reactivity"
import { createElement } from "react"

/** Entry point, and the only module allowed to use Bun APIs (see docs/architecture.md). */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"

import pkg from "../package.json"
import { Root } from "./features/app/app"
import { Monitor } from "./monitor"
import {
  AppConfig,
  FileLogger,
  Git,
  HttpLive,
  Paths,
  RepoHistory,
  RunCache,
} from "./platform"
import { Providers } from "./providers"
import { resolveTheme, themeName } from "./ui"

const HELP = `tuiaux ${pkg.version} — your CI pipelines, live in your terminal

Usage: tuiaux [--help] [--version]`

/** Exit code for a crash (EX_SOFTWARE). */
const CRASHED = 70

const appLayer = (cwd: string) =>
  Monitor.layer(cwd).pipe(
    Layer.provideMerge(Providers.layer),
    Layer.provideMerge(
      Layer.mergeAll(
        AppConfig.layer,
        Git.layer,
        RepoHistory.layer,
        RunCache.layer,
        HttpLive,
      ),
    ),
    Layer.provideMerge(FileLogger),
    Layer.provideMerge(Paths.layer),
    Layer.provideMerge(BunServices.layer),
  )

/** The terminal UI, until the user quits. The renderer is a scoped resource: closing restores the terminal. */
const tui = Effect.gen(function* () {
  const { config, issues, path: configPath } = yield* AppConfig
  const monitor = yield* Monitor
  const runInApp = Effect.runForkWith(yield* Effect.context<Monitor>())
  const quit = yield* Deferred.make<void>()

  const renderer = yield* Effect.acquireRelease(
    // Signals are Effect's job (they interrupt this fiber), not OpenTUI's.
    Effect.promise(() =>
      createCliRenderer({ exitOnCtrlC: false, exitSignals: [] }),
    ),
    opened =>
      Effect.promise(() => {
        opened.destroy()

        return opened.closed
      }),
  )

  const terminal = yield* Effect.tryPromise(() =>
    renderer.getPalette({ timeout: 300 }),
  ).pipe(Effect.option)

  const theme = themeName(config.theme.name)

  createRoot(renderer).render(
    createElement(Root, {
      theme: resolveTheme(
        theme.name,
        config.theme.colors,
        Option.getOrUndefined(terminal),
      ),
      app: {
        version: pkg.version,
        state: Atom.subscriptionRef(monitor.state),
        configPath,
        configIssues: [...issues, ...Option.toArray(theme.issue)],
        run: command => void runInApp(command(monitor)),
        quit: () => Effect.runSync(Deferred.succeed(quit, undefined)),
      },
    }),
  )

  yield* Deferred.await(quit)
})

/** After the terminal is restored: the details go to the log, one line to the user. */
const reportCrash = (cause: Cause.Cause<unknown>) =>
  Effect.gen(function* () {
    yield* Effect.logFatal("tuiaux crashed", cause)
    yield* Console.error(`tuiaux crashed; details in ${(yield* Paths).logFile}`)
  })

const program = Effect.gen(function* () {
  const args = Bun.argv.slice(2)

  if (args.includes("--version") || args.includes("-v"))
    return yield* Console.log(pkg.version)

  if (args.includes("--help") || args.includes("-h"))
    return yield* Console.log(HELP)

  // Services are built before the renderer opens: a startup failure never leaves the terminal half-set.
  yield* tui.pipe(
    Effect.scoped,
    Effect.tapCause(cause =>
      Cause.hasInterruptsOnly(cause) ? Effect.void : reportCrash(cause),
    ),
    Effect.provide(appLayer(process.cwd())),
  )
})

BunRuntime.runMain(program, {
  disableErrorReporting: true,
  teardown: (exit, onExit) =>
    onExit(
      Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause) ? 0 : CRASHED,
    ),
})
