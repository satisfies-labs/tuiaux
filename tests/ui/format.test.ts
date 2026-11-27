import { describe, expect, test } from "bun:test"
import { Duration, Option } from "effect"

import {
  fit,
  formatAge,
  formatDuration,
  plural,
  visibleWindow,
} from "../../src/ui"

const NOW = new Date("2026-11-27T12:00:00Z")
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000)

describe("formatDuration", () => {
  test("m:ss under an hour, h:mm:ss above, — without a duration", () => {
    const of = (seconds: number) =>
      formatDuration(Option.some(Duration.seconds(seconds)))

    expect(of(42)).toBe("0:42")
    expect(of(727)).toBe("12:07")
    expect(of(3753)).toBe("1:02:33")
    expect(formatDuration(Option.none())).toBe("—")
  })
})

describe("formatAge", () => {
  test("compact relative ages", () => {
    expect(
      [5, 42, 720, 10_800, 172_800, 3_024_000].map(s => formatAge(ago(s), NOW)),
    ).toEqual(["now", "42s", "12m", "3h", "2d", "5w"])
    expect(formatAge(undefined, NOW)).toBe("—")
  })
})

describe("fit", () => {
  test("pads short text and cuts long text with an ellipsis", () => {
    expect(fit("ci", 4)).toBe("ci  ")
    expect(fit("pipeline", 5)).toBe("pipe…")
  })
})

describe("plural", () => {
  test("singular for one, plural otherwise", () => {
    expect([0, 1, 2].map(n => plural(n, "repo"))).toEqual([
      "0 repos",
      "1 repo",
      "2 repos",
    ])
  })
})

describe("visibleWindow", () => {
  test("everything when it fits, else a slice centered on the cursor", () => {
    expect(visibleWindow(3, 2, 5)).toEqual({ start: 0, end: 3 })
    expect(visibleWindow(20, 10, 4)).toEqual({ start: 8, end: 12 })
    expect(visibleWindow(20, 0, 4)).toEqual({ start: 0, end: 4 })
    expect(visibleWindow(20, 19, 4)).toEqual({ start: 16, end: 20 })
  })
})
