import { expect } from "bun:test"
import { Effect, Equal, FileSystem, Layer, Option, Path } from "effect"

import { CachedRuns, Paths, RunCache } from "../../src/platform"
import { T0, repo, run } from "../support/domain"
import { layer } from "../support/effect"
import { TestPlatform } from "../support/platform"

const entry = (path = "acme/api") =>
  new CachedRuns({
    repo: repo(path),
    runs: [run({ status: "running" }), run({ number: 2 })],
    fetchedAt: T0,
  })

const cacheFiles = Effect.gen(function* () {
  const { runCacheDir } = yield* Paths
  const fs = yield* FileSystem.FileSystem

  return (yield* fs.exists(runCacheDir))
    ? yield* fs.readDirectory(runCacheDir)
    : []
})

layer(Layer.provideMerge(RunCache.layer, TestPlatform))(it => {
  it.effect("round-trips runs per repo", () =>
    Effect.gen(function* () {
      const cache = yield* RunCache
      yield* cache.write(entry("acme/api"))
      yield* cache.write(entry("acme/web"))
      const read = yield* cache.read(repo("acme/api"))
      expect(
        Option.isSome(read) && Equal.equals(read.value, entry("acme/api")),
      ).toBe(true)
      expect((yield* cacheFiles).toSorted()).toEqual([
        "github%3Agithub.com%2Facme%2Fapi.json",
        "github%3Agithub.com%2Facme%2Fweb.json",
      ])
    }),
  )

  it.effect("None when nothing is cached", () =>
    Effect.gen(function* () {
      const cache = yield* RunCache
      expect(yield* cache.read(repo())).toEqual(Option.none())
    }),
  )

  it.effect("remove deletes the entry, and is fine when there is none", () =>
    Effect.gen(function* () {
      const cache = yield* RunCache
      yield* cache.write(entry())
      yield* cache.remove(repo())
      yield* cache.remove(repo())
      expect(yield* cache.read(repo())).toEqual(Option.none())
    }),
  )

  for (const [label, content] of [
    ["corrupt", "{ nope"],
    ["outdated", JSON.stringify({ version: 0, entry: {} })],
  ] as const) {
    it.effect(`a ${label} entry reads as None and is dropped`, () =>
      Effect.gen(function* () {
        const cache = yield* RunCache
        const { runCacheDir } = yield* Paths
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        yield* fs.makeDirectory(runCacheDir, { recursive: true })
        yield* fs.writeFileString(
          path.join(runCacheDir, "github%3Agithub.com%2Facme%2Fapi.json"),
          content,
        )
        expect(yield* cache.read(repo())).toEqual(Option.none())
        expect(yield* cacheFiles).toEqual([])
      }),
    )
  }
})
