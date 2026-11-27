# Adding a provider

A provider turns a CI's API into tuiaux's domain model (`src/domain`). It knows nothing about the UI or the `Monitor`, and never imports another provider. The CI is assumed to be the code host (ADR 0005).

A REST provider is mostly declarations: the shared client in `providers/rest.ts` handles the token, the HTTP call, the status → `ProviderError` mapping and decoding.

## 1. Describe the payloads — `src/providers/<name>/api.ts`

Schemas for the fields you use, nothing more. Timestamps as `Schema.DateFromString`; unknown states as plain strings, folded later.

```ts
export const FooRun = Schema.Struct({
  id: Schema.Int,
  state: Schema.String,
  created_at: Schema.DateFromString,
  finished_at: Schema.NullOr(Schema.DateFromString),
})

export const FooRunsPage = Schema.Struct({ runs: Schema.Array(FooRun) })
```

## 2. Map them — `src/providers/<name>/map.ts`

Pure functions, payload → `Run` / `Job`. Fold every native state into a `Status` with a `switch`; unknown states map to `idle`, never throw. Every domain field is required (use `undefined` for what the API doesn't give).

## 3. Declare the module — `src/providers/<name>/index.ts`

```ts
export const Foo: ProviderModule = {
  kind: "foo",
  matchRemote: url =>
    parseGitUrl(url).pipe(
      Option.filter(remote => remote.host === "foo.dev"),
      Option.map(remote => new RepoRef({ kind: "foo", host: "foo.dev", path: remote.path })),
    ),
  make: Effect.gen(function* () {
    const rest = yield* restClient({
      kind: "foo",
      host: "foo.dev",
      baseUrl: "https://api.foo.dev",
      headers: { accept: "application/json" },
      cli: { command: "foo", args: ["auth", "token"], login: "foo auth login", install: "https://foo.dev/cli" },
      rateLimitResetHeader: "x-ratelimit-reset",
      isRateLimit403: () => false,
      forbiddenHint: "The token can't read this repo: it needs the `ci:read` scope.",
    })

    return {
      kind: "foo",
      capabilities: { rerun: false, cancel: false, logs: "none" },
      listRuns: (repo, opts) =>
        rest
          .get(FooRunsPage, `/repos/${repo.path}/runs`, { limit: opts.limit, branch: opts.branch }, { repo, resource: "repo" })
          .pipe(Effect.map(page => page.runs.map(run => mapRun(repo, run)))),
      listJobs: run => /* same shape, resource: "run" */,
    } satisfies Provider
  }),
}
```

What the shared client does with the answer: 2xx → decoded with your schema (bad payload → `Unexpected`), 401/403 → `Unauthorized` (the token is dropped and read again on refresh), 429 or a rate-limit 403 → `RateLimited` until the reset header, 404 → `NotFound`, anything else → `Unexpected` with the error body as cause. No retries: that's the `Monitor`'s job.

## 4. Register it

- Add the kind to `ProviderKind` in `src/domain/refs.ts`.
- Add one line to `providers` in `src/providers/registry.ts`: the record is typed by `ProviderKind`, so forgetting it doesn't compile.

## 5. Test it — `tests/providers/<name>.test.ts`

No network, ever. Hand-written fixtures in `tests/fixtures/<name>/`, and `withProvider` from `tests/support/providers.ts`, which builds your module over a fake `HttpClient` and a fake CLI:

```ts
const setup = withProvider(Foo, "foo", always({ status: 200, body: runsFixture }), foo => foo.listRuns(repo, OPTS), LOGGED_IN)
```

Cover at least: status folding, a running and a failed run, the request sent (path, params, token), and the error mapping (`failsWith(RateLimited, { … })`).

## 6. Document it

README (authentication table), `docs/configuration.md` if anything changes there, and the changelog through your `feat(foo): …` commit.

## Provider notes

|        | Runs                              | Jobs                    | Steps | Token                                 | Notes                                                    |
| ------ | --------------------------------- | ----------------------- | ----- | ------------------------------------- | -------------------------------------------------------- |
| GitHub | `GET /repos/{o}/{r}/actions/runs` | `…/runs/{id}/jobs`      | ✓     | `gh auth token --hostname github.com` | `status` + `conclusion` folded; 403 may be a rate limit  |
| GitLab | `GET /projects/{id}/pipelines`    | `…/pipelines/{id}/jobs` | —     | `glab config get token --host …`      | project path URL-encoded; jobs carry `stage`; no commit title in the list |
