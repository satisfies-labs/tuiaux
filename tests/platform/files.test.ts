import { expect } from "bun:test"
import { Effect, FileSystem, Option } from "effect"

import { readFileIfExists, writeFileAtomic } from "../../src/platform"
import { layer } from "../support/effect"
import { TestHome, TestPlatform } from "../support/platform"

layer(TestPlatform)(it => {
  it.effect(
    "writeFileAtomic creates parent directories and leaves no temp file behind",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const { dir } = yield* TestHome
        const file = `${dir}/a/b/c.json`
        yield* writeFileAtomic(file, "one")
        yield* writeFileAtomic(file, "two")
        expect(yield* fs.readFileString(file)).toBe("two")
        expect(yield* fs.readDirectory(`${dir}/a/b`)).toEqual(["c.json"])
      }),
  )

  it.effect(
    "readFileIfExists: None for a missing file, the content otherwise",
    () =>
      Effect.gen(function* () {
        const { dir } = yield* TestHome
        expect(yield* readFileIfExists(`${dir}/nope.txt`)).toEqual(
          Option.none(),
        )
        yield* writeFileAtomic(`${dir}/yes.txt`, "hi")
        expect(yield* readFileIfExists(`${dir}/yes.txt`)).toEqual(
          Option.some("hi"),
        )
      }),
  )

  it.effect("readFileIfExists still fails on other errors", () =>
    Effect.gen(function* () {
      const { dir } = yield* TestHome
      const exit = yield* Effect.exit(readFileIfExists(dir)) // a directory
      expect(exit._tag).toBe("Failure")
    }),
  )
})
