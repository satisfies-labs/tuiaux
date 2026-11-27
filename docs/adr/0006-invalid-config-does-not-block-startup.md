# An invalid config never blocks startup

Because `tuiaux` is meant to be typed anywhere, an invalid `config.toml` doesn't stop the app. Invalid keys, or the whole file on a syntax error, fall back to defaults, and the problems are listed in a dialog when the TUI opens. A missing file is created empty. Config is read once at startup.
