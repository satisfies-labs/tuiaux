import { homedir } from "node:os";
import { join } from "node:path";

/** XDG base directories, with the usual fallbacks (also used on macOS for a consistent dotfiles story). */
const xdg = (envVar: string, fallback: string) => process.env[envVar] || join(homedir(), fallback);

export const paths = {
  configDir: () => join(xdg("XDG_CONFIG_HOME", ".config"), "tuiaux"),
  configFile: () => join(paths.configDir(), "config.toml"),
  themesDir: () => join(paths.configDir(), "themes"),
  stateDir: () => join(xdg("XDG_STATE_HOME", ".local/state"), "tuiaux"),
  logFile: () => join(paths.stateDir(), "tuiaux.log"),
  cacheDir: () => join(xdg("XDG_CACHE_HOME", ".cache"), "tuiaux"),
};
