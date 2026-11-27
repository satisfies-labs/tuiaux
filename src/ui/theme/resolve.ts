import { Option, Record } from "effect"

import { type ColorToken, type Config, InvalidValue } from "../../platform"
import { THEMES, type ThemeName, isThemeName } from "./themes"

/** Every token resolved to a color OpenTUI can paint: hex, or `transparent` for the terminal's bg. */
export type Theme = { readonly [Token in ColorToken]: string }

/** What the terminal reported about its colors; null where it didn't answer. */
export interface TerminalColors {
  readonly palette: ReadonlyArray<string | null>
  readonly defaultForeground: string | null
  readonly defaultBackground: string | null
}

const FALLBACK = THEMES["tuiaux-dark"]

const resolveColor = (
  token: ColorToken,
  value: string,
  terminal: TerminalColors | undefined,
): string => {
  if (value.startsWith("#")) return value

  // Keep the terminal's own background, transparency included.
  if (value === "default")
    return token === "bg"
      ? "transparent"
      : (terminal?.defaultForeground ?? FALLBACK[token])

  return (
    terminal?.palette[Number(value.slice("ansi:".length))] ?? FALLBACK[token]
  )
}

/** A built-in theme with the user's overrides, resolved against the terminal's colors. */
export const resolveTheme = (
  name: ThemeName,
  overrides: Config["theme"]["colors"],
  terminal: TerminalColors | undefined,
): Theme =>
  Record.map(
    { ...THEMES[name], ...overrides },
    (value: string, token: ColorToken) => resolveColor(token, value, terminal),
  )

/** The configured theme name, or the default with an issue to show when it's unknown. */
export const themeName = (
  configured: string,
): { readonly name: ThemeName; readonly issue: Option.Option<InvalidValue> } =>
  isThemeName(configured)
    ? { name: configured, issue: Option.none() }
    : {
        name: "terminal",
        issue: Option.some(
          new InvalidValue({
            key: "theme.name",
            expected: `one of ${Object.keys(THEMES).join(", ")}`,
            got: JSON.stringify(configured),
            fallback: "terminal",
          }),
        ),
      }
