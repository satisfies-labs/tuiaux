import { Schema } from "effect"

import { ProviderKind, RepoRef } from "./refs"

/**
 * Expected failures of a provider call. Kept as values in state and turned into text at render time.
 * Host-wide errors (AuthMissing, Unauthorized, RateLimited) carry `kind` + `host`: they affect every repo
 * of that host at once.
 */

const HostFields = { kind: ProviderKind, host: Schema.String }

/** No usable credentials: the provider's CLI is missing or not logged in. */
export class AuthMissing extends Schema.TaggedError<
  AuthMissing,
  { readonly brand: unique symbol }
>()("AuthMissing", {
  ...HostFields,
  reason: Schema.Literals(["cli-not-installed", "not-logged-in"]),
  /** What the user should do, written by the provider: "Run `gh auth login`". */
  hint: Schema.String,
}) {}

/** Credentials were rejected (401/403): expired token or missing scope. */
export class Unauthorized extends Schema.TaggedError<
  Unauthorized,
  { readonly brand: unique symbol }
>()("Unauthorized", {
  ...HostFields,
  hint: Schema.String,
}) {}

/** The host's API quota is exhausted until `resetAt`. */
export class RateLimited extends Schema.TaggedError<
  RateLimited,
  { readonly brand: unique symbol }
>()("RateLimited", {
  ...HostFields,
  resetAt: Schema.Date,
}) {}

/** The repo, run or job doesn't exist (or isn't visible with these credentials). */
export class NotFound extends Schema.TaggedError<
  NotFound,
  { readonly brand: unique symbol }
>()("NotFound", {
  repo: RepoRef,
  resource: Schema.Literals(["repo", "run", "job"]),
}) {}

/** The host couldn't be reached: DNS, timeout, connection reset. */
export class Network extends Schema.TaggedError<
  Network,
  { readonly brand: unique symbol }
>()("Network", {
  ...HostFields,
  cause: Schema.Defect(),
}) {}

/** The host answered something we can't use: 5xx, unexpected status, payload that doesn't match its schema. */
export class Unexpected extends Schema.TaggedError<
  Unexpected,
  { readonly brand: unique symbol }
>()("Unexpected", {
  ...HostFields,
  /** HTTP status, absent when the response itself was fine but couldn't be decoded. */
  status: Schema.UndefinedOr(Schema.Int),
  cause: Schema.Defect(),
}) {}

export const ProviderError = Schema.Union([
  AuthMissing,
  Unauthorized,
  RateLimited,
  NotFound,
  Network,
  Unexpected,
])

export type ProviderError = typeof ProviderError.Type
