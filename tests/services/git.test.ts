import { describe, expect, test } from "bun:test";
import { parseRemote, providerForHost } from "../../src/services/git";

describe("parseRemote", () => {
  test.each([
    ["git@github.com:satisfies-labs/tuiaux.git", "github.com", "satisfies-labs/tuiaux"],
    ["https://github.com/satisfies-labs/tuiaux", "github.com", "satisfies-labs/tuiaux"],
    ["https://github.com/satisfies-labs/tuiaux.git/", "github.com", "satisfies-labs/tuiaux"],
    ["ssh://git@gitlab.example.org:2222/group/sub/project.git", "gitlab.example.org", "group/sub/project"],
    ["git@gitlab.com:group/sub/project.git", "gitlab.com", "group/sub/project"],
  ])("%s", (url, host, path) => {
    expect(parseRemote(url)).toEqual({ host, path });
  });

  test("rejects garbage", () => {
    expect(parseRemote("not a url")).toBeUndefined();
    expect(parseRemote("https://github.com/")).toBeUndefined();
  });
});

describe("providerForHost", () => {
  const known = { github: "github.com", gitlab: "git.company.io" };
  test("detects providers", () => {
    expect(providerForHost("github.com", known)).toBe("github");
    expect(providerForHost("git.company.io", known)).toBe("gitlab");
    expect(providerForHost("gitlab.example.org", known)).toBe("gitlab");
    expect(providerForHost("bitbucket.org", known)).toBeUndefined();
  });
});
