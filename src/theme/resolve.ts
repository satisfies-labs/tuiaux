import type { ColorToken } from "../config/schema";
import { isThemeName, THEMES, type ThemeSpec } from "./themes";

/** Fully resolved theme: every token is a hex color OpenTUI can paint (or `transparent` for the default bg). */
export type Theme = Record<ColorToken, string> & { name: string };

export interface TerminalColorsLike {
  palette: (string | null)[];
  defaultForeground: string | null;
  defaultBackground: string | null;
}

const FALLBACK = THEMES["tuiaux-dark"];

/**
 * Resolve a theme spec into hex colors.
 * `ansi:N` → detected palette[N], `default` → detected fg/bg; both fall back to tuiaux-dark.
 */
export function resolveTheme(
  name: string,
  overrides: Partial<Record<ColorToken, string>> = {},
  terminal?: TerminalColorsLike,
): Theme {
  const base: ThemeSpec = isThemeName(name) ? THEMES[name] : FALLBACK;
  const spec: Record<ColorToken, string> = { ...base, ...overrides };
  const out = { name: isThemeName(name) ? name : "tuiaux-dark" } as Theme;
  for (const [token, value] of Object.entries(spec) as [ColorToken, string][]) {
    out[token] = resolveValue(token, value, terminal);
  }
  return out;
}

function resolveValue(token: ColorToken, value: string, t?: TerminalColorsLike): string {
  if (value.startsWith("#")) return value;
  if (value === "default") {
    if (token === "bg") return "transparent"; // keep the terminal's own background (and its transparency)
    return t?.defaultForeground ?? FALLBACK[token];
  }
  const idx = Number(value.slice("ansi:".length));
  return t?.palette[idx] ?? FALLBACK[token];
}
