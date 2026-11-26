import { expect, test } from "bun:test";
import { resolveTheme, THEMES } from "../../src/theme";

test("hex themes resolve as-is, with overrides", () => {
  const t = resolveTheme("tokyo-night", { success: "#00ff00" });
  expect(t.success).toBe("#00ff00");
  expect(t.failure).toBe(THEMES["tokyo-night"].failure);
});

test("terminal theme uses the detected palette, falls back to tuiaux-dark", () => {
  const palette = Array.from({ length: 16 }, (_, i) => `#0000${i.toString(16).padStart(2, "0")}`);
  const t = resolveTheme(
    "terminal",
    {},
    { palette, defaultForeground: "#eeeeee", defaultBackground: "#111111" },
  );
  expect(t.success).toBe(palette[2] as string);
  expect(t.text).toBe("#eeeeee");
  expect(t.bg).toBe("transparent");
  expect(resolveTheme("terminal").success).toBe(THEMES["tuiaux-dark"].success);
});

test("unknown theme falls back", () => {
  expect(resolveTheme("nope").name).toBe("tuiaux-dark");
});
