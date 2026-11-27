import { Schema } from "effect"

/**
 * The subset of the GitLab REST API v4 tuiaux reads. Only the fields used by `map.ts`;
 * anything else in the payload is ignored. Timestamps decode to `Date`; an invalid one fails decoding.
 */

export const GlPipeline = Schema.Struct({
  id: Schema.Int,
  iid: Schema.Int,
  name: Schema.optionalKey(Schema.NullOr(Schema.String)),
  status: Schema.String,
  source: Schema.String,
  ref: Schema.String,
  sha: Schema.String,
  created_at: Schema.DateFromString,
  updated_at: Schema.DateFromString,
  web_url: Schema.String,
})

export type GlPipeline = typeof GlPipeline.Type

export const GlJob = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  stage: Schema.String,
  status: Schema.String,
  started_at: Schema.NullOr(Schema.DateFromString),
  finished_at: Schema.NullOr(Schema.DateFromString),
  web_url: Schema.String,
})

export type GlJob = typeof GlJob.Type

/** `GET /projects/:id/pipelines` */
export const GlPipelinesPage = Schema.Array(GlPipeline)

/** `GET /projects/:id/pipelines/:pipeline_id/jobs` */
export const GlJobsPage = Schema.Array(GlJob)
