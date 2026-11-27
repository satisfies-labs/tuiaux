import { describe, expect, test } from "bun:test"
import { Effect, Equal, Exit } from "effect"

import {
  AuthMissing,
  NotFound,
  RateLimited,
  Unexpected,
} from "../../src/domain"
import { T0, repo } from "../support/domain"

const authMissing = () =>
  new AuthMissing({
    kind: "gitlab",
    host: "gitlab.com",
    reason: "not-logged-in",
    hint: "Run `glab auth login`",
  })

describe("ProviderError", () => {
  test("is a tagged, yieldable error", () => {
    const error = new RateLimited({
      kind: "github",
      host: "github.com",
      resetAt: T0,
    })

    const exit = Effect.runSyncExit(
      Effect.gen(function* () {
        return yield* error
      }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(error._tag).toBe("RateLimited")
    expect(error).toBeInstanceOf(Error)
  })

  test("compares by value, so a repeated error doesn't change state", () => {
    expect(Equal.equals(authMissing(), authMissing())).toBe(true)
    expect(
      Equal.equals(
        new NotFound({ repo: repo(), resource: "run" }),
        new NotFound({ repo: repo(), resource: "repo" }),
      ),
    ).toBe(false)
  })

  test("Unexpected keeps the HTTP status when there is one", () => {
    const cause = new Error("bad gateway")
    expect(
      new Unexpected({ kind: "github", host: "github.com", status: 502, cause })
        .status,
    ).toBe(502)
    expect(
      new Unexpected({
        kind: "github",
        host: "github.com",
        status: undefined,
        cause,
      }).status,
    ).toBeUndefined()
  })
})
