import { ConfigProvider, Context, Effect, FileSystem, Layer } from "effect"

/** Test layers for platform services: real Bun file system and processes, inside a throwaway HOME. */
import { BunServices } from "@effect/platform-bun"

import { Paths } from "../../src/platform"

/** The temporary HOME of the current test. Deleted when the test ends. */
export class TestHome extends Context.Service<
  TestHome,
  { readonly dir: string }
>()("test/TestHome") {}

const home = Layer.effect(
  TestHome,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    return {
      dir: yield* fs.makeTempDirectoryScoped({ prefix: "tuiaux-test-" }),
    }
  }),
)

/** Env of the test: only HOME unless overridden. */
export const envLayer = (env: (home: string) => Record<string, string>) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const { dir } = yield* TestHome

      return ConfigProvider.layer(ConfigProvider.fromEnvRecord(env(dir)))
    }),
  )

/** BunServices + TestHome + Paths under it (+ env as a ConfigProvider). */
export const testPlatform = (
  env: (home: string) => Record<string, string> = dir => ({ HOME: dir }),
) =>
  Paths.layer.pipe(
    Layer.provideMerge(envLayer(env)),
    Layer.provideMerge(home),
    Layer.provideMerge(BunServices.layer),
  )

export const TestPlatform = testPlatform()
