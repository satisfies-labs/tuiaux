import { Schema } from "effect"

/**
 * The subset of the GitHub REST API (v2022-11-28) tuiaux reads. Only the fields used by `map.ts`;
 * anything else in the payload is ignored. Timestamps decode to `Date`; an invalid one fails decoding.
 */

const Timestamp = Schema.NullOr(Schema.DateFromString)

export const GhStep = Schema.Struct({
  name: Schema.String,
  number: Schema.Int,
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  started_at: Schema.optionalKey(Timestamp),
  completed_at: Schema.optionalKey(Timestamp),
})

export type GhStep = typeof GhStep.Type

export const GhJob = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  started_at: Timestamp,
  completed_at: Timestamp,
  html_url: Schema.NullOr(Schema.String),
  steps: Schema.optionalKey(Schema.Array(GhStep)),
})

export type GhJob = typeof GhJob.Type

export const GhRun = Schema.Struct({
  id: Schema.Int,
  name: Schema.optionalKey(Schema.NullOr(Schema.String)),
  run_number: Schema.Int,
  status: Schema.NullOr(Schema.String),
  conclusion: Schema.NullOr(Schema.String),
  head_branch: Schema.NullOr(Schema.String),
  head_sha: Schema.String,
  display_title: Schema.optionalKey(Schema.String),
  event: Schema.String,
  actor: Schema.optionalKey(
    Schema.NullOr(Schema.Struct({ login: Schema.String })),
  ),
  created_at: Schema.DateFromString,
  run_started_at: Schema.optionalKey(Timestamp),
  updated_at: Schema.DateFromString,
  html_url: Schema.String,
})

export type GhRun = typeof GhRun.Type

/** `GET /repos/{owner}/{repo}/actions/runs` */
export const GhRunsPage = Schema.Struct({ workflow_runs: Schema.Array(GhRun) })

/** `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs` */
export const GhJobsPage = Schema.Struct({ jobs: Schema.Array(GhJob) })

/** `GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing`: the real duration, absent while it runs. */
export const GhRunTiming = Schema.Struct({
  run_duration_ms: Schema.optionalKey(Schema.Int),
})
