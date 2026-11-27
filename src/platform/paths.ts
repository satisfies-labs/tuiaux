import { Config, Context, Effect, Layer, Option, Path } from "effect"

/** Where tuiaux reads and writes. XDG base directories, also on macOS (`~/.config`, not `~/Library`). */
export class Paths extends Context.Service<
  Paths,
  {
    /** `~/.config/tuiaux/config.toml` — owned by the user. */
    readonly configFile: string
    /** `~/.local/state/tuiaux/repos.json` — remembered repos. */
    readonly historyFile: string
    /** `~/.local/state/tuiaux/tuiaux.log` */
    readonly logFile: string
    /** `~/.cache/tuiaux/runs/` — last known runs per repo, disposable. */
    readonly runCacheDir: string
  }
>()("tuiaux/Paths") {
  static readonly layer = Layer.effect(
    Paths,
    Effect.gen(function* () {
      const path = yield* Path.Path
      const home = yield* Config.String("HOME")

      // The XDG spec says to ignore unset, empty and relative values.
      const xdg = (name: string, fallback: string) =>
        Config.option(Config.String(name)).pipe(
          Config.map(value =>
            Option.getOrElse(
              Option.filter(value, path.isAbsolute),
              () => fallback,
            ),
          ),
        )

      const configHome = yield* xdg(
        "XDG_CONFIG_HOME",
        path.join(home, ".config"),
      )

      const stateHome = yield* xdg(
        "XDG_STATE_HOME",
        path.join(home, ".local", "state"),
      )

      const cacheHome = yield* xdg("XDG_CACHE_HOME", path.join(home, ".cache"))

      return {
        configFile: path.join(configHome, "tuiaux", "config.toml"),
        historyFile: path.join(stateHome, "tuiaux", "repos.json"),
        logFile: path.join(stateHome, "tuiaux", "tuiaux.log"),
        runCacheDir: path.join(cacheHome, "tuiaux", "runs"),
      }
    }),
  )
}
