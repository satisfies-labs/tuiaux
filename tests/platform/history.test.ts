import { expect } from "bun:test"
import { Context, Effect, FileSystem, Layer, Path } from "effect"
import { TestClock } from "effect/testing"

import { Paths, RepoHistory } from "../../src/platform"
import { repo } from "../support/domain"
import { layer } from "../support/effect"
import { TestPlatform } from "../support/platform"

const names = Effect.gen(function* () {
  const history = yield* RepoHistory

  return (yield* history.list).map(r => r.repo.path)
})

layer(Layer.provideMerge(RepoHistory.layer, TestPlatform))(it => {
  it.effect("starts empty", () =>
    Effect.map(names, list => expect(list).toEqual([])),
  )

  it.effect("lists remembered repos, most recently seen first", () =>
    Effect.gen(function* () {
      const history = yield* RepoHistory
      yield* history.remember({ repo: repo("acme/api") })
      yield* TestClock.adjust("1 minute")
      yield* history.remember({ repo: repo("acme/web") })
      yield* TestClock.adjust("1 minute")
      yield* history.remember({ repo: repo("acme/api") })
      expect(yield* names).toEqual(["acme/api", "acme/web"])
      expect((yield* history.list)[0]?.lastSeenAt.getTime()).toBe(120_000)
    }),
  )

  it.effect(
    "seeing a repo again keeps what the new sighting doesn't know",
    () =>
      Effect.gen(function* () {
        const history = yield* RepoHistory
        yield* history.remember({
          repo: repo(),
          localPath: "/src/api",
          branch: "main",
        })
        yield* history.remember({ repo: repo(), branch: "feat/x" })
        const [entry] = yield* history.list
        expect(entry?.localPath).toBe("/src/api")
        expect(entry?.lastBranch).toBe("feat/x")
      }),
  )

  it.effect("forget removes only that repo", () =>
    Effect.gen(function* () {
      const history = yield* RepoHistory
      yield* history.remember({ repo: repo("acme/api") })
      yield* history.remember({ repo: repo("acme/web") })
      yield* history.forget(repo("acme/api"))
      expect(yield* names).toEqual(["acme/web"])
    }),
  )

  it.effect(
    "GitHub and GitLab repos with the same path are different repos",
    () =>
      Effect.gen(function* () {
        const history = yield* RepoHistory
        yield* history.remember({ repo: repo("acme/api", "github") })
        yield* history.remember({ repo: repo("acme/api", "gitlab") })
        expect((yield* history.list).map(r => r.repo.kind).toSorted()).toEqual([
          "github",
          "gitlab",
        ])
      }),
  )

  it.effect("two tuiaux processes don't erase each other's entries", () =>
    Effect.gen(function* () {
      const first = yield* RepoHistory

      // A second, independent service instance on the same file, like another process.
      const second = yield* Layer.build(Layer.fresh(RepoHistory.layer)).pipe(
        Effect.map(ctx => Context.get(ctx, RepoHistory)),
      )

      expect(second).not.toBe(first)
      yield* first.list // both have "loaded" the empty file
      yield* second.list
      yield* first.remember({ repo: repo("acme/api") })
      yield* second.remember({ repo: repo("acme/web") })
      expect((yield* first.list).map(r => r.repo.path).toSorted()).toEqual([
        "acme/api",
        "acme/web",
      ])
    }),
  )

  it.effect(
    "a corrupt file is moved aside, not overwritten, and reads as empty",
    () =>
      Effect.gen(function* () {
        const { historyFile } = yield* Paths
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        yield* fs.makeDirectory(path.dirname(historyFile), { recursive: true })
        yield* fs.writeFileString(historyFile, "{ not json")
        expect(yield* names).toEqual([])
        const files = yield* fs.readDirectory(path.dirname(historyFile))
        const aside = files.find(f => f.startsWith("repos.json.corrupt-"))
        expect(aside).toBeDefined()
        expect(
          yield* fs.readFileString(
            path.join(path.dirname(historyFile), aside ?? ""),
          ),
        ).toBe("{ not json")
      }),
  )

  it.effect("the file is versioned JSON", () =>
    Effect.gen(function* () {
      const history = yield* RepoHistory
      const { historyFile } = yield* Paths
      const fs = yield* FileSystem.FileSystem
      yield* history.remember({ repo: repo(), branch: "main" })
      expect(JSON.parse(yield* fs.readFileString(historyFile))).toEqual({
        version: 1,
        repos: [
          {
            repo: { kind: "github", host: "github.com", path: "acme/api" },
            localPath: null,
            lastBranch: "main",
            lastSeenAt: "1970-01-01T00:00:00.000Z",
          },
        ],
      })
    }),
  )
})
