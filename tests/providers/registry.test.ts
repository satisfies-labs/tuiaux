import { expect } from "bun:test"
import { Effect, Layer, Option } from "effect"

import { Providers } from "../../src/providers"
import { fakeHttpClient } from "../fakes/http-client"
import { fakeSpawner } from "../fakes/spawner"
import { layer } from "../support/effect"

const services = Providers.layer.pipe(
  Layer.provide(
    Layer.merge(
      fakeHttpClient(() => "unreachable").layer,
      fakeSpawner({}).layer,
    ),
  ),
)

layer(services)(it => {
  it.effect("builds one provider per kind", () =>
    Effect.gen(function* () {
      const providers = yield* Providers

      expect(providers.get("github").kind).toBe("github")
      expect(providers.get("gitlab").kind).toBe("gitlab")
    }),
  )

  it.effect("matches a remote with the provider that hosts it", () =>
    Effect.gen(function* () {
      const { matchRemote } = yield* Providers

      const kindOf = (url: string) =>
        Option.getOrUndefined(matchRemote(url))?.kind

      expect(kindOf("git@github.com:a/b.git")).toBe("github")
      expect(kindOf("https://gitlab.com/group/sub/project")).toBe("gitlab")
      expect(kindOf("git@bitbucket.org:a/b.git")).toBeUndefined()
    }),
  )
})
