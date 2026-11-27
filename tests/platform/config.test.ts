import { describe, expect, test } from "bun:test"
import { Effect, FileSystem, Layer, Path } from "effect"
import type { PlatformError } from "effect/PlatformError"

import {
  AppConfig,
  DEFAULT_CONFIG,
  InvalidToml,
  InvalidValue,
  Paths,
  UnknownKey,
  Unreadable,
  decodeConfig,
} from "../../src/platform"
import { layer } from "../support/effect"
import { TestPlatform } from "../support/platform"

describe("decodeConfig", () => {
  test("empty file → defaults, no issues", () => {
    expect(decodeConfig("")).toEqual({ config: DEFAULT_CONFIG, issues: [] })
  })

  test("reads every setting", () => {
    const { config, issues } = decodeConfig(`
      [theme]
      name = "tuiaux-dark"
      [theme.colors]
      accent = "#34D399"
      bg = "default"
      muted = "ansi:8"

      [refresh]
      active = 3
      idle = 60

      [notifications]
      enabled = false
      bell = false
      on = ["failure", "success"]
    `)

    expect(issues).toEqual([])
    expect(config).toEqual({
      theme: {
        name: "tuiaux-dark",
        colors: { accent: "#34D399", bg: "default", muted: "ansi:8" },
      },
      refresh: { active: 3, idle: 60 },
      notifications: {
        enabled: false,
        bell: false,
        on: ["failure", "success"],
      },
    })
  })

  test("an invalid value falls back to its default, the other keys are kept", () => {
    const { config, issues } = decodeConfig(`
      [refresh]
      active = 1
      idle = 60
    `)

    expect(config.refresh).toEqual({ active: 5, idle: 60 })
    expect(issues).toEqual([
      new InvalidValue({
        key: "refresh.active",
        expected: "a whole number of seconds from 2 to 300",
        got: "1",
        fallback: "5",
      }),
    ])
  })

  test("wrong types are invalid values", () => {
    const { config, issues } = decodeConfig(`
      [refresh]
      idle = "30"
      [notifications]
      enabled = "yes"
      on = ["failure", "always"]
    `)

    expect(config.refresh.idle).toBe(30)
    expect(config.notifications).toEqual(DEFAULT_CONFIG.notifications)
    expect(
      issues.map(i =>
        i instanceof InvalidValue ? `${i.key}=${i.got}` : i._tag,
      ),
    ).toEqual([
      'refresh.idle="30"',
      'notifications.enabled="yes"',
      'notifications.on=["failure","always"]',
    ])
  })

  test("bad colors are dropped one by one", () => {
    const { config, issues } = decodeConfig(`
      [theme.colors]
      accent = "#34D399"
      failure = "red"
      running = "ansi:16"
    `)

    expect(config.theme.colors).toEqual({ accent: "#34D399" })
    // Reported in token order.
    expect(
      issues.map(i => (i instanceof InvalidValue ? i.key : i._tag)),
    ).toEqual(["theme.colors.running", "theme.colors.failure"])
  })

  test("unknown keys are reported and ignored, at any level", () => {
    const { config, issues } = decodeConfig(`
      repos = ["github:acme/api"]
      [refresh]
      activ = 3
      [theme.colors]
      backgroud = "#000000"
      [github]
      host = "github.acme.corp"
    `)

    expect(config).toEqual(DEFAULT_CONFIG)
    expect(issues).toEqual([
      new UnknownKey({ key: "repos" }),
      new UnknownKey({ key: "github" }),
      new UnknownKey({ key: "theme.colors.backgroud" }),
      new UnknownKey({ key: "refresh.activ" }),
    ])
  })

  test("a section that isn't a table is reported", () => {
    const { config, issues } = decodeConfig(`refresh = 5`)
    expect(config.refresh).toEqual(DEFAULT_CONFIG.refresh)
    expect(issues).toEqual([
      new InvalidValue({
        key: "refresh",
        expected: "a table",
        got: "5",
        fallback: "defaults",
      }),
    ])
  })

  test("invalid TOML → every default, with the position of the error", () => {
    const { config, issues } = decodeConfig(
      `[refresh]\nactive = 5\nidle = = 3\n`,
    )

    expect(config).toEqual(DEFAULT_CONFIG)
    expect(issues).toEqual([
      new InvalidToml({ line: 3, column: 9, message: "Invalid value '='" }),
    ])
  })

  test("accepts every TOML form a hand-written config uses", () => {
    const { config, issues } = decodeConfig(
      [
        "# comment",
        'theme = { name = "tuiaux-light", colors = { accent = "#000000" } }',
        "refresh.active = 3 # dotted key",
        "[notifications]",
        "on = [",
        '  "failure",',
        "  'success', # literal string, trailing comma",
        "]",
      ].join("\r\n"),
    )

    expect(issues).toEqual([])
    expect(config.theme).toEqual({
      name: "tuiaux-light",
      colors: { accent: "#000000" },
    })
    expect(config.refresh.active).toBe(3)
    expect(config.notifications.on).toEqual(["failure", "success"])
  })

  test("a duplicate key is a TOML error", () => {
    expect(decodeConfig("[refresh]\nactive = 3\nactive = 4").issues).toEqual([
      new InvalidToml({
        line: 3,
        column: 11,
        message: "Cannot redefine existing key 'active'",
      }),
    ])
  })

  test("long values are shortened in messages", () => {
    const { issues } = decodeConfig(
      `[theme]\nname = ${JSON.stringify("x".repeat(100))}\n[refresh]\nactive = "${"y".repeat(100)}"`,
    )

    const got = issues[0] instanceof InvalidValue ? issues[0].got : ""
    expect(got.length).toBe(40)
    expect(got.endsWith("…")).toBe(true)
  })
})

const configFile = Effect.gen(function* () {
  return (yield* AppConfig).path
})

layer(Layer.provideMerge(AppConfig.layer, TestPlatform))(it => {
  it.effect("missing file → defaults, and an empty file is created", () =>
    Effect.gen(function* () {
      const { config, issues } = yield* AppConfig
      const fs = yield* FileSystem.FileSystem
      expect(config).toEqual(DEFAULT_CONFIG)
      expect(issues).toEqual([])
      expect(yield* fs.readFileString(yield* configFile)).toBe("")
    }),
  )
})

/** AppConfig over a config file prepared by `setup(path, fs)`. */
const withFile = (
  setup: (
    path: string,
    fs: FileSystem.FileSystem,
  ) => Effect.Effect<void, PlatformError>,
) =>
  Layer.provideMerge(
    AppConfig.layer,
    Layer.effectDiscard(
      Effect.gen(function* () {
        const paths = yield* Paths
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        yield* fs.makeDirectory(path.dirname(paths.configFile), {
          recursive: true,
        })
        yield* setup(paths.configFile, fs)
      }).pipe(Effect.orDie),
    ).pipe(Layer.provideMerge(TestPlatform)),
  )

describe("AppConfig", () => {
  layer(
    withFile((file, fs) => fs.writeFileString(file, "[refresh]\nactive = 2\n")),
  )(it => {
    it.effect("reads an existing file", () =>
      Effect.gen(function* () {
        const { config, issues } = yield* AppConfig
        expect(config.refresh.active).toBe(2)
        expect(issues).toEqual([])
      }),
    )
  })

  layer(withFile((file, fs) => fs.makeDirectory(file)))(it => {
    it.effect(
      "an unreadable file → defaults + Unreadable, never a failure",
      () =>
        Effect.gen(function* () {
          const { config, issues } = yield* AppConfig
          expect(config).toEqual(DEFAULT_CONFIG)
          expect(issues.map(i => i._tag)).toEqual(["Unreadable"])
          expect(issues[0]).toBeInstanceOf(Unreadable)
        }),
    )
  })
})
