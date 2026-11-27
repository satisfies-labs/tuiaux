import type { Effect, Option } from "effect"
import type { HttpClient } from "effect/http"
import type { ChildProcessSpawner } from "effect/process"

import type {
  Job,
  ProviderError,
  ProviderKind,
  RepoRef,
  Run,
  RunRef,
} from "../domain"

/** What a provider can do beyond listing. The UI hides keys for what's missing. */
export interface Capabilities {
  readonly rerun: boolean
  readonly cancel: boolean
  readonly logs: "stream" | "poll" | "none"
}

export interface ListRunsOpts {
  /** Only runs of this branch; every branch when undefined. */
  readonly branch: string | undefined
  /** Newest first, at most this many. */
  readonly limit: number
}

/** A CI service, translated into the domain model. Knows nothing about the UI, the store or polling. */
export interface Provider {
  readonly kind: ProviderKind
  readonly capabilities: Capabilities
  /** Newest first. */
  readonly listRuns: (
    repo: RepoRef,
    opts: ListRunsOpts,
  ) => Effect.Effect<ReadonlyArray<Run>, ProviderError>
  /** In pipeline order. */
  readonly listJobs: (
    run: RunRef,
  ) => Effect.Effect<ReadonlyArray<Job>, ProviderError>
}

/** Everything tuiaux needs to know about one CI service. Registered once in `registry.ts`. */
export interface ProviderModule {
  readonly kind: ProviderKind
  /** The repo a git remote URL points to, when this provider hosts it. */
  readonly matchRemote: (remoteUrl: string) => Option.Option<RepoRef>
  readonly make: Effect.Effect<
    Provider,
    never,
    HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner
  >
}
