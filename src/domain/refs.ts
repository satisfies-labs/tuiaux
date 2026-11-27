import { Schema } from "effect";

/** CI services tuiaux can talk to. A provider is both the code host and the CI. */
export const ProviderKind = Schema.Literals(["github", "gitlab"]);
export type ProviderKind = typeof ProviderKind.Type;

export const RunId = Schema.String.check(Schema.isMinLength(1)).pipe(Schema.brand("RunId"));
export type RunId = typeof RunId.Type;

export const JobId = Schema.String.check(Schema.isMinLength(1)).pipe(Schema.brand("JobId"));
export type JobId = typeof JobId.Type;

/** Stable string identity of a repo: `github:github.com/owner/name`. Used as a map key and in file names. */
export const RepoKey = Schema.String.pipe(Schema.brand("RepoKey"));
export type RepoKey = typeof RepoKey.Type;

/** Where a repo lives. */
export class RepoRef extends Schema.Class<RepoRef>("RepoRef")({
  kind: ProviderKind,
  /** API host, e.g. `github.com`, `gitlab.com`. */
  host: Schema.String.check(Schema.isMinLength(1)),
  /** `owner/name` on GitHub, full namespace path on GitLab (`group/sub/project`). */
  path: Schema.String.check(Schema.isPattern(/^[^/\s]+(\/[^/\s]+)+$/)),
}) {
  get key(): RepoKey {
    return RepoKey.make(`${this.kind}:${this.host}/${this.path}`);
  }
}

/** Where a run lives. */
export class RunRef extends Schema.Class<RunRef>("RunRef")({
  repo: RepoRef,
  id: RunId,
}) {}

/** Where a job lives. */
export class JobRef extends Schema.Class<JobRef>("JobRef")({
  run: RunRef,
  id: JobId,
}) {}
