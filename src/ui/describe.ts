import { Match } from "effect"

import type { ProviderError } from "../domain"
import type { ConfigIssue } from "../platform"

const clock = (date: Date) => date.toTimeString().slice(0, 5)

/** One line for the user; errors are kept as values in state and only turned into text here. */
export const describeError = (error: ProviderError): string =>
  Match.valueTags(error, {
    AuthMissing: missing => missing.hint,
    Unauthorized: rejected => rejected.hint,
    RateLimited: limited =>
      `${limited.host} rate limit reached, back at ${clock(limited.resetAt)}`,
    NotFound: missing => `${missing.resource} not found or not visible`,
    Network: unreachable => `can't reach ${unreachable.host}`,
    Unexpected: odd =>
      odd.status === undefined
        ? `${odd.host} sent an unreadable answer`
        : `${odd.host} answered HTTP ${odd.status}`,
  })

export const describeIssue = (issue: ConfigIssue): string =>
  Match.valueTags(issue, {
    InvalidValue: invalid =>
      `${invalid.key}: expected ${invalid.expected}, got ${invalid.got}; using ${invalid.fallback}`,
    UnknownKey: unknown => `${unknown.key}: unknown setting, ignored`,
    InvalidToml: toml =>
      toml.line === undefined
        ? `not valid TOML (${toml.message}); using defaults`
        : `not valid TOML at line ${toml.line}, column ${toml.column} (${toml.message}); using defaults`,
    Unreadable: unreadable =>
      `can't be read (${unreadable.message}); using defaults`,
  })
