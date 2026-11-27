import { describe, expect, test } from "bun:test"
import { Equal, Schema } from "effect"

import { RepoRef } from "../../src/domain"
import { repo, runRef } from "../support/domain"

describe("RepoRef", () => {
  test("key is `kind:host/path`", () => {
    expect(String(repo("acme/api").key)).toBe("github:github.com/acme/api")
    expect(String(repo("group/sub/project", "gitlab").key)).toBe(
      "gitlab:gitlab.com/group/sub/project",
    )
  })

  test("accepts GitLab nested namespaces, rejects paths without an owner", () => {
    const decode = Schema.decodeUnknownExit(RepoRef)
    expect(
      decode({ kind: "gitlab", host: "gitlab.com", path: "a/b/c/d" })._tag,
    ).toBe("Success")

    for (const path of ["api", "acme/", "/api", "acme//api", "acme/my api"]) {
      expect(decode({ kind: "github", host: "github.com", path })._tag).toBe(
        "Failure",
      )
    }
  })

  test("rejects unknown providers", () => {
    expect(
      Schema.decodeUnknownExit(RepoRef)({
        kind: "bitbucket",
        host: "bitbucket.org",
        path: "a/b",
      })._tag,
    ).toBe("Failure")
  })

  test("compares by value", () => {
    expect(Equal.equals(repo("acme/api"), repo("acme/api"))).toBe(true)
    expect(Equal.equals(repo("acme/api"), repo("acme/web"))).toBe(false)
    expect(Equal.equals(runRef("1"), runRef("1"))).toBe(true)
    expect(Equal.equals(runRef("1"), runRef("2"))).toBe(false)
  })
})
