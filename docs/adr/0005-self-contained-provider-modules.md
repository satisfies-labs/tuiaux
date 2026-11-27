# Providers are self-contained modules

Each provider declares `matchRemote`, its own credential lookup, its own HTTP → `ProviderError` classification (rate-limit headers differ per API) and its `capabilities`. Providers are registered in one list, so adding Bitbucket or Gitea is a new folder plus one line, with no changes to `monitor` or `features`.

## Consequences

We assume the CI service is the code host. CI services that build repos hosted elsewhere (CircleCI, Buildkite, Jenkins) would need a separate "repo → CI" mapping, which is deliberately out of scope.
