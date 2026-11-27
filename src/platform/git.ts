import { Context, Effect, Layer, Match, Option } from "effect"
import { ChildProcessSpawner } from "effect/process"

import { runCommand } from "./command"

export interface Remote {
  readonly name: string
  readonly url: string
}

/** The git checkout tuiaux was started in. */
export interface LocalRepo {
  /** Top-level directory of the checkout. */
  readonly root: string
  /** Current branch; None when HEAD is detached. */
  readonly branch: Option.Option<string>
  /** Fetch remotes, `origin` first, then `upstream`, then the others by name. */
  readonly remotes: ReadonlyArray<Remote>
}

/** `origin` first, then `upstream`, then every other remote. */
const rank = (remote: Remote): number =>
  Match.value(remote.name).pipe(
    Match.when("origin", () => 0),
    Match.when("upstream", () => 1),
    Match.orElse(() => 2),
  )

/** Parses `git remote -v` output, keeping fetch URLs. */
export const parseRemotes = (output: string): ReadonlyArray<Remote> => {
  const remotes = new Map<string, string>()

  for (const line of output.split("\n")) {
    const match = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line.trim())

    if (match?.[1] !== undefined && match[2] !== undefined)
      remotes.set(match[1], match[2])
  }

  return [...remotes]
    .map(([name, url]) => ({ name, url }))
    .toSorted((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

const hostAndPath = (
  host: string,
  path: string,
): Option.Option<{ host: string; path: string }> => {
  const normalized = path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")

  return host !== "" && normalized.includes("/")
    ? Option.some({ host: host.toLowerCase(), path: normalized })
    : Option.none()
}

/**
 * Host and path of a git remote URL, in any form git accepts for network remotes:
 * `git@host:owner/name.git`, `ssh://git@host:22/owner/name`, `https://user:token@host/owner/name.git`,
 * `git://host/owner/name`. Credentials and ports are dropped; local paths and `file://` give None.
 */
export const parseGitUrl = (
  url: string,
): Option.Option<{ host: string; path: string }> => {
  const scheme = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(url)

  if (scheme) {
    const [, protocol = "", rest = ""] = scheme

    if (
      !["https", "http", "ssh", "git", "git+ssh", "ssh+git"].includes(
        protocol.toLowerCase(),
      )
    )
      return Option.none()
    const slash = rest.indexOf("/")

    if (slash === -1) return Option.none()

    const authority = rest
      .slice(0, slash)
      .replace(/^.*@/, "")
      .replace(/:\d*$/, "")

    return hostAndPath(authority, rest.slice(slash))
  }

  // scp-like syntax: [user@]host:path — only when the colon comes before any slash (else it's a local path).
  const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(url)

  if (scp?.[1] !== undefined && scp[2] !== undefined)
    return hostAndPath(scp[1], scp[2])

  return Option.none()
}

/** Reads the local checkout. Never fails: no git, not a repo, or a git error all mean None. */
export class Git extends Context.Service<
  Git,
  {
    readonly detect: (cwd: string) => Effect.Effect<Option.Option<LocalRepo>>
  }
>()("tuiaux/Git") {
  static readonly layer = Layer.effect(
    Git,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

      // Don't take index locks: tuiaux runs next to the user's own git commands.
      const git = (cwd: string, ...args: ReadonlyArray<string>) =>
        runCommand("git", ["-C", cwd, ...args], {
          env: { GIT_OPTIONAL_LOCKS: "0" },
        }).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner,
          ),
        )

      return {
        detect: Effect.fn("Git.detect")(
          function* (cwd: string) {
            const top = yield* git(cwd, "rev-parse", "--show-toplevel")

            if (top.exitCode !== 0) return Option.none<LocalRepo>()
            const root = top.stdout.trim()

            const [head, remotes] = yield* Effect.all(
              [
                git(root, "symbolic-ref", "--quiet", "--short", "HEAD"),
                git(root, "remote", "-v"),
              ],
              { concurrency: 2 },
            )

            const branch =
              head.exitCode === 0
                ? Option.some(head.stdout.trim())
                : Option.none<string>()

            return Option.some<LocalRepo>({
              root,
              branch,
              remotes: parseRemotes(remotes.stdout),
            })
          },
          self =>
            self.pipe(
              Effect.catchCause(cause =>
                Effect.logDebug("git: detection failed", cause).pipe(
                  Effect.as(Option.none<LocalRepo>()),
                ),
              ),
            ),
        ),
      }
    }),
  )
}
