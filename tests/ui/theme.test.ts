import { describe, expect, test } from "bun:test"
import { Option } from "effect"

import { THEMES, resolveTheme, themeName } from "../../src/ui"

const terminal = {
  palette: ["#000000", "#cc0000", "#00cc00", null],
  defaultForeground: "#eeeeee",
  defaultBackground: "#111111",
}

describe("resolveTheme", () => {
  test("terminal: palette indexes and default colors, transparent background", () => {
    const theme = resolveTheme("terminal", {}, terminal)

    expect(theme.bg).toBe("transparent")
    expect(theme.text).toBe("#eeeeee")
    expect(theme.failure).toBe("#cc0000")
    expect(theme.success).toBe("#00cc00")
  })

  test("colors the terminal didn't report fall back to tuiaux-dark", () => {
    expect(resolveTheme("terminal", {}, terminal).running).toBe(
      THEMES["tuiaux-dark"].running,
    )
    expect(resolveTheme("terminal", {}, undefined).text).toBe(
      THEMES["tuiaux-dark"].text,
    )
  })

  test("user overrides win over the theme", () => {
    const theme = resolveTheme(
      "nord",
      { success: "#123456", idle: "ansi:2" },
      terminal,
    )

    expect(theme.success).toBe("#123456")
    expect(theme.idle).toBe("#00cc00")
    expect(theme.bg).toBe(THEMES.nord.bg)
  })
})

describe("themeName", () => {
  test("a built-in name is used as is", () => {
    expect(themeName("dracula")).toEqual({
      name: "dracula",
      issue: Option.none(),
    })
  })

  test("an unknown name falls back to terminal, with an issue to show", () => {
    const { name, issue } = themeName("dracla")

    expect(name).toBe("terminal")
    expect(Option.getOrUndefined(issue)).toMatchObject({
      key: "theme.name",
      got: '"dracla"',
      fallback: "terminal",
    })
  })
})
