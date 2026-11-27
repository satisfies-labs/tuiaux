import { expect } from "bun:test"
import { Effect } from "effect"

import { Paths } from "../../src/platform"
import { layer } from "../support/effect"
import { TestHome, testPlatform } from "../support/platform"

layer(testPlatform(home => ({ HOME: home })))(it => {
  it.effect("defaults to the XDG locations under HOME (also on macOS)", () =>
    Effect.gen(function* () {
      const paths = yield* Paths
      const { dir } = yield* TestHome
      expect(paths).toEqual({
        configFile: `${dir}/.config/tuiaux/config.toml`,
        historyFile: `${dir}/.local/state/tuiaux/repos.json`,
        logFile: `${dir}/.local/state/tuiaux/tuiaux.log`,
        runCacheDir: `${dir}/.cache/tuiaux/runs`,
      })
    }),
  )
})

layer(
  testPlatform(home => ({
    HOME: home,
    XDG_CONFIG_HOME: "/xdg/config",
    XDG_STATE_HOME: "/xdg/state",
    XDG_CACHE_HOME: "/xdg/cache",
  })),
)(it => {
  it.effect("honours XDG variables", () =>
    Effect.gen(function* () {
      const paths = yield* Paths
      expect(paths.configFile).toBe("/xdg/config/tuiaux/config.toml")
      expect(paths.historyFile).toBe("/xdg/state/tuiaux/repos.json")
      expect(paths.runCacheDir).toBe("/xdg/cache/tuiaux/runs")
    }),
  )
})

layer(
  testPlatform(home => ({
    HOME: home,
    XDG_CONFIG_HOME: "relative/dir",
    XDG_STATE_HOME: "",
  })),
)(it => {
  it.effect("ignores relative and empty XDG values, as the spec requires", () =>
    Effect.gen(function* () {
      const paths = yield* Paths
      const { dir } = yield* TestHome
      expect(paths.configFile).toBe(`${dir}/.config/tuiaux/config.toml`)
      expect(paths.historyFile).toBe(`${dir}/.local/state/tuiaux/repos.json`)
    }),
  )
})
