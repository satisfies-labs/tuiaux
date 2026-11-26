import { describe, expect, test } from "bun:test";
import { ConfigError, defaultConfig, parseConfig } from "../../src/config";
import { parseRepoEntry } from "../../src/services/targets";

describe("config", () => {
  test("defaults", () => {
    const c = defaultConfig();
    expect(c.theme.name).toBe("terminal");
    expect(c.refresh).toEqual({ active: 5, idle: 30 });
    expect(c.repos).toEqual([]);
  });

  test("parses a full file", () => {
    const c = parseConfig(`
repos = ["github:satisfies-labs/tuiaux", "gitlab:team/web", { provider = "gitlab", path = "infra/k8s", host = "git.company.io" }]
[theme]
name = "tokyo-night"
[theme.colors]
success = "#9ece6a"
idle = "ansi:8"
[gitlab]
host = "git.company.io"
`);
    expect(c.theme.colors).toEqual({ success: "#9ece6a", idle: "ansi:8" });
    expect(c.repos).toHaveLength(3);
  });

  test("readable errors", () => {
    expect(() => parseConfig(`[theme.colors]\nsuccess = "green"`)).toThrow(ConfigError);
    expect(() => parseConfig(`unknown = 1`)).toThrow(/unknown|Unrecognized/i);
    expect(() => parseConfig(`[refresh]\nactive = 0`)).toThrow(/refresh.active/);
  });

  test("repo entries", () => {
    const c = parseConfig(`[gitlab]\nhost = "git.company.io"`);
    expect(parseRepoEntry("github:a/b", c).repo).toEqual({
      provider: "github",
      host: "github.com",
      path: "a/b",
    });
    expect(parseRepoEntry("gitlab:g/p", c).repo).toEqual({
      provider: "gitlab",
      host: "git.company.io",
      path: "g/p",
    });
    expect(parseRepoEntry("gitlab.example.org:g/s/p", c).repo).toEqual({
      provider: "gitlab",
      host: "gitlab.example.org",
      path: "g/s/p",
    });
  });
});

test("config.example.toml is valid", async () => {
  const source = await Bun.file(new URL("../../config.example.toml", import.meta.url)).text();
  expect(() => parseConfig(source, "config.example.toml")).not.toThrow();
});
