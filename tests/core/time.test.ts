import { describe, expect, test } from "bun:test";
import { formatAge, formatDuration, truncate } from "../../src/core/time";

describe("time", () => {
  test("formatDuration", () => {
    expect(formatDuration(42_000)).toBe("0:42");
    expect(formatDuration(727_000)).toBe("12:07");
    expect(formatDuration(3_753_000)).toBe("1:02:33");
    expect(formatDuration(Number.NaN)).toBe("—");
  });

  test("formatAge", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const ago = (s: number) => new Date(now.getTime() - s * 1000);
    expect(formatAge(ago(3), now)).toBe("now");
    expect(formatAge(ago(42), now)).toBe("42s");
    expect(formatAge(ago(12 * 60), now)).toBe("12m");
    expect(formatAge(ago(3 * 3600), now)).toBe("3h");
    expect(formatAge(ago(2 * 86400), now)).toBe("2d");
    expect(formatAge(undefined, now)).toBe("—");
  });

  test("truncate", () => {
    expect(truncate("feat/horror", 8)).toBe("feat/ho…");
    expect(truncate("main", 8)).toBe("main");
  });
});
