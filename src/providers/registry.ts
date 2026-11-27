import { Context, Effect, Layer, Option, Record } from "effect"
import type { HttpClient } from "effect/http"
import type { ChildProcessSpawner } from "effect/process"

import type { ProviderKind, RepoRef } from "../domain"
import { GitHub } from "./github"
import { GitLab } from "./gitlab"
import type { Provider, ProviderModule } from "./provider"

/** Every supported CI service. Adding one is a new folder and one line here. */
export const providers = {
  github: GitHub,
  gitlab: GitLab,
} as const satisfies { readonly [K in ProviderKind]: ProviderModule }

/** The built providers, one per kind. */
export class Providers extends Context.Service<
  Providers,
  {
    readonly get: (kind: ProviderKind) => Provider
    /** The repo a git remote points to, from the first provider that hosts it. */
    readonly matchRemote: (remoteUrl: string) => Option.Option<RepoRef>
  }
>()("tuiaux/Providers") {
  static readonly layer: Layer.Layer<
    Providers,
    never,
    HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(
    Providers,
    Effect.gen(function* () {
      const built = yield* Effect.all(
        Record.map(providers, module => module.make),
      )

      const modules = Object.values(providers)

      return {
        get: kind => built[kind],
        matchRemote: url =>
          Option.firstSomeOf(modules.map(module => module.matchRemote(url))),
      }
    }),
  )
}
