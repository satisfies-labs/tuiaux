# Credentials come only from gh and glab

v1 reads tokens only from `gh auth token` and `glab`, and supports only github.com and gitlab.com. There are no env vars, no `token_command`, and no tokens in config. tuiaux never stores secrets, and login is handled by the tools developers already use. Each provider owns its credential lookup, so a provider with no CLI (e.g. Bitbucket) can use another source later without changing the others.
