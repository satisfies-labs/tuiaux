import { Schema } from "effect"

/**
 * The subset of the GitLab API tuiaux reads. Pipelines come from GraphQL: one request gives what
 * REST spreads over three (real start and end, author, commit title), which matters on gitlab.com's
 * free plan, limited to about 100 requests a minute per user. Jobs come from REST.
 */

/** Recent pipelines of a project, newest first; `ref` filters on a branch when not null. */
export const PIPELINES_QUERY = `query($path: ID!, $first: Int!, $ref: String) {
  project(fullPath: $path) {
    pipelines(first: $first, ref: $ref) {
      nodes {
        id iid name status source ref sha createdAt startedAt finishedAt path
        user { username }
        commit { title }
      }
    }
  }
}`

export const GlPipeline = Schema.Struct({
  /** Global id: `gid://gitlab/Ci::Pipeline/123`. */
  id: Schema.String,
  iid: Schema.NumberFromString,
  name: Schema.NullOr(Schema.String),
  /** `SUCCESS`, `FAILED`, `RUNNING`, … (GraphQL upper case). */
  status: Schema.String,
  source: Schema.NullOr(Schema.String),
  ref: Schema.NullOr(Schema.String),
  sha: Schema.String,
  createdAt: Schema.DateFromString,
  startedAt: Schema.NullOr(Schema.DateFromString),
  finishedAt: Schema.NullOr(Schema.DateFromString),
  /** Web path of the pipeline page: `/group/project/-/pipelines/123`. */
  path: Schema.String,
  user: Schema.NullOr(Schema.Struct({ username: Schema.String })),
  commit: Schema.NullOr(Schema.Struct({ title: Schema.String })),
})

export type GlPipeline = typeof GlPipeline.Type

/** The GraphQL answer; `project` is null when it doesn't exist or isn't visible with this token. */
export const GlPipelinesResult = Schema.Struct({
  data: Schema.Struct({
    project: Schema.NullOr(
      Schema.Struct({
        pipelines: Schema.Struct({ nodes: Schema.Array(GlPipeline) }),
      }),
    ),
  }),
})

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

/** `GET /v4/projects/:id/pipelines/:pipeline_id/jobs` */
export const GlJobsPage = Schema.Array(GlJob)
