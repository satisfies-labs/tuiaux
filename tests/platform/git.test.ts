import { describe, expect, test } from "bun:test"
import { Effect, FileSystem, Layer, Option } from "effect"

import { Git, parseGitUrl, parseRemotes, runCommand } from "../../src/platform"
import { layer } from "../support/effect"
import { TestHome, TestPlatform } from "../support/platform"

describe("parseGitUrl", () => {
  const cases: Array<[string, { host: string; path: string } | undefined]> = [
    ["git@github.com:acme/api.git", { host: "github.com", path: "acme/api" }],
    ["git@github.com:acme/api", { host: "github.com", path: "acme/api" }],
    ["github.com:acme/api.git", { host: "github.com", path: "acme/api" }],
    [
      "https://github.com/acme/api.git",
      { host: "github.com", path: "acme/api" },
    ],
    ["https://github.com/acme/api/", { host: "github.com", path: "acme/api" }],
    ["https://GitHub.com/acme/api", { host: "github.com", path: "acme/api" }],
    [
      "https://x-access-token:ghp_secret@github.com/acme/api.git",
      { host: "github.com", path: "acme/api" },
    ],
    [
      "ssh://git@gitlab.com:2222/group/sub/project.git",
      { host: "gitlab.com", path: "group/sub/project" },
    ],
    [
      "git+ssh://git@gitlab.com/group/project",
      { host: "gitlab.com", path: "group/project" },
    ],
    [
      "git://gitlab.com/group/project.git",
      { host: "gitlab.com", path: "group/project" },
    ],
    [
      "https://gitlab.com/group/sub/deeper/project.git",
      { host: "gitlab.com", path: "group/sub/deeper/project" },
    ],
    // Not network remotes, or not owner/name.
    ["/home/me/src/api", undefined],
    ["./api", undefined],
    ["file:///home/me/src/api", undefined],
    ["https://github.com/acme", undefined],
    ["https://github.com", undefined],
  ]

  for (const [url, expected] of cases) {
    test(url, () => {
      expect(parseGitUrl(url)).toEqual(
        expected === undefined ? Option.none() : Option.some(expected),
      )
    })
  }

  test("never keeps credentials", () => {
    const parsed = parseGitUrl("https://user:hunter2@github.com/acme/api.git")
    expect(JSON.stringify(parsed)).not.toContain("hunter2")
  })
})

describe("parseRemotes", () => {
  test("keeps fetch URLs, origin first, then upstream, then by name", () => {
    const output = [
      "fork\tgit@github.com:me/api.git (fetch)",
      "fork\tgit@github.com:me/api.git (push)",
      "upstream\thttps://github.com/acme/api.git (fetch)",
      "origin\tgit@github.com:team/api.git (fetch)",
      "origin\tgit@github.com:team/api-push.git (push)",
      "",
    ].join("\n")

    expect(parseRemotes(output)).toEqual([
      { name: "origin", url: "git@github.com:team/api.git" },
      { name: "upstream", url: "https://github.com/acme/api.git" },
      { name: "fork", url: "git@github.com:me/api.git" },
    ])
  })
})

const git = (cwd: string, ...args: Array<string>) =>
  runCommand("git", ["-C", cwd, ...args]).pipe(
    Effect.flatMap(r =>
      r.exitCode === 0
        ? Effect.succeed(r.stdout)
        : Effect.die(new Error(r.stderr)),
    ),
  )

/** A real repo in the test's HOME: `main` with one commit and an origin remote. */
const makeRepo = Effect.gen(function* () {
  const { dir } = yield* TestHome
  const fs = yield* FileSystem.FileSystem
  const root = `${dir}/work/api`
  yield* fs.makeDirectory(`${root}/src/deep`, { recursive: true })
  yield* git(root, "init", "--quiet", "--initial-branch=main")
  yield* git(
    root,
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@t",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "init",
  )
  yield* git(root, "remote", "add", "origin", "git@github.com:acme/api.git")

  // Resolve symlinks (macOS /var → /private/var), as git does for --show-toplevel.
  return yield* fs.realPath(root)
})

layer(Layer.provideMerge(Git.layer, TestPlatform))(it => {
  it.live("detects root, branch and remotes, from any subdirectory", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo
      const found = yield* (yield* Git).detect(`${root}/src/deep`)
      expect(found).toEqual(
        Option.some({
          root,
          branch: Option.some("main"),
          remotes: [{ name: "origin", url: "git@github.com:acme/api.git" }],
        }),
      )
    }),
  )

  it.live("branch is None on a detached HEAD", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo
      yield* git(root, "checkout", "--quiet", "--detach")
      const found = yield* (yield* Git).detect(root)
      expect(Option.map(found, r => r.branch)).toEqual(
        Option.some(Option.none()),
      )
    }),
  )

  it.live("None outside a git repo", () =>
    Effect.gen(function* () {
      const { dir } = yield* TestHome
      expect(yield* (yield* Git).detect(dir)).toEqual(Option.none())
    }),
  )

  it.live("None for a directory that doesn't exist", () =>
    Effect.gen(function* () {
      const { dir } = yield* TestHome
      expect(yield* (yield* Git).detect(`${dir}/missing`)).toEqual(
        Option.none(),
      )
    }),
  )
})
