# Effect owns the runtime; the UI is a view over services

tuiaux is one Effect v4 program: it builds the service layers, acquires the OpenTUI renderer as a scoped resource and mounts React with an atom runtime that reuses the already-built services. Polling and CI state live in the `Monitor` service, and atoms only adapt it for the UI. We chose this over letting atoms own polling (less code), because startup failures must happen before the terminal changes, and terminal restore on quit, signals or defects must be guaranteed by scope finalizers rather than by React.

## Considered options

- Atoms-first (`Atom.make(Stream…)` polls directly): rejected, because it ties business logic to rendering and makes `Monitor` untestable without a renderer.
- `@opentui/solid` or imperative `@opentui/core`: rejected. There's no official Effect bridge for Solid, and the imperative API means too much hand-written UI code. React has `@effect/atom-react`.
