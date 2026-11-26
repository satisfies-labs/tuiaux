# Adding a provider

A provider turns a CI's API into tuiaux's domain model. It knows nothing about the UI, the store or the poller.

## 1. Implement the interface

`src/providers/<name>/index.ts`:

```ts
import type { Provider } from "../types";

export function createFooProvider(opts: { host: string; token: string; http?: HttpClient }): Provider {
  const http =
    opts.http ??
    createHttpClient({
      baseUrl: `https://${opts.host}/api`,
      headers: { Authorization: `Bearer ${opts.token}` },
    });
  return {
    id: "foo",
    host: opts.host,
    async listRuns(repo, { branch, limit } = {}) {
      /* GET … → map to Run[] (newest first) */
    },
    async listJobs(repo, runId) {
      /* GET … → map to Job[] (pipeline order) */
    },
  };
}
```

Put the payload → domain mapping in `map.ts` (pure functions), including a `fooStatus()` that folds every native state into a `Status`. Unknown states map to `idle`, never throw.

## 2. Register it

- Add the id to `ProviderId` in `src/core/types.ts`.
- Create it in `ProviderRegistry.create()` (`src/providers/registry.ts`).
- Teach `resolveToken()` (`src/services/auth.ts`) its env vars / CLI, and `providerForHost()` (`src/services/git.ts`) its hosts.
- Add a `[foo]` section to `src/config/schema.ts` if it needs settings.

## 3. Test it with fixtures

Save real (anonymised) API responses in `tests/fixtures/foo/` and test the provider through a fake `HttpClient` — see `tests/providers/github.test.ts`. Cover at least: status folding, a running run, a failed run, nested paths/URL encoding if relevant.

## 4. Document it

README (auth + scopes), `docs/configuration.md`, and a line in the changelog via your `feat(foo): …` commit.

## Provider notes

|        | Runs                              | Jobs                    | Steps           | Notes                                                          |
| ------ | --------------------------------- | ----------------------- | --------------- | -------------------------------------------------------------- |
| GitHub | `GET /repos/{o}/{r}/actions/runs` | `…/runs/{id}/jobs`      | ✓               | `status` + `conclusion` folded; GHE base `https://host/api/v3` |
| GitLab | `GET /projects/{id}/pipelines`    | `…/pipelines/{id}/jobs` | — (stage shown) | project path URL-encoded; list has no commit title (TODO v1.1) |
