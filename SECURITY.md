# Security policy

tuiaux reads CI data with **your** API tokens. It never stores them: tokens are resolved at startup from `token_command`, environment variables, or the `gh` / `glab` CLIs, kept in memory and only sent to the configured API host.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead: _Security → Report a vulnerability_ on this repository. You will get an answer within a week.

Supported versions: the latest release only (tuiaux is 0.x).
