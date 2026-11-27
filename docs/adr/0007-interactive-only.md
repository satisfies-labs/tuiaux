# Interactive only: no headless commands, no demo mode

v1 has a single entry point, `tuiaux`, which opens the TUI. The former `status --json` and `watch` commands and the demo provider were dropped: they weren't needed and cost a single-poll mode in `Monitor` and a fake provider in the domain. The watch *view* remains. Fakes exist only in `tests/`.
