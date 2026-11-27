# Security policy

tuiaux reads CI data with **your** API tokens. It never stores them: they are read from the `gh` / `glab` CLIs when needed, kept in memory (redacted in logs) and only sent to github.com or gitlab.com. Text from CI APIs is stripped of control characters before tuiaux puts it into terminal escape sequences, and only `https://` links are handed to the system opener.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead: _Security → Report a vulnerability_ on this repository. You will get an answer within a week.

Supported versions: the latest release only (tuiaux is 0.x).
