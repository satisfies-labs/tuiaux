import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { Headers } from "effect/http"

import { resetAt } from "../../src/providers/rest"
import { it } from "../support/effect"

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0)

const at = (headers: Record<string, string>) =>
  resetAt(Headers.fromInput(headers), "x-ratelimit-reset", NOW)

describe("resetAt", () => {
  it.effect("reads the epoch-seconds reset header first", () =>
    Effect.sync(() =>
      expect(
        at({ "x-ratelimit-reset": "1800000000", "retry-after": "5" }),
      ).toEqual(new Date(1_800_000_000_000)),
    ),
  )

  it.effect("else Retry-After in seconds", () =>
    Effect.sync(() =>
      expect(at({ "retry-after": "30" })).toEqual(new Date(NOW + 30_000)),
    ),
  )

  it.effect("else Retry-After as an HTTP date", () =>
    Effect.sync(() =>
      expect(at({ "retry-after": "Fri, 27 Nov 2026 12:05:00 GMT" })).toEqual(
        new Date(NOW + 5 * 60_000),
      ),
    ),
  )

  it.effect("else, or when headers are garbage, a minute from now", () =>
    Effect.sync(() => {
      expect(at({})).toEqual(new Date(NOW + 60_000))
      expect(at({ "x-ratelimit-reset": "soon", "retry-after": "-1" })).toEqual(
        new Date(NOW + 60_000),
      )
    }),
  )
})
