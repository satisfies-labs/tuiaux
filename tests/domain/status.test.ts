import { describe, expect, test } from "bun:test"
import { Array } from "effect"

import {
  Status,
  aggregate,
  byUrgency,
  isActive,
  toneOf,
} from "../../src/domain"

const ALL = Status.literals

describe("toneOf", () => {
  test("folds every status into one of the four brand tones", () => {
    expect(Object.fromEntries(ALL.map(s => [s, toneOf(s)]))).toEqual({
      success: "success",
      failure: "failure",
      running: "running",
      queued: "idle",
      cancelled: "idle",
      skipped: "idle",
      idle: "idle",
    })
  })
})

describe("isActive", () => {
  test("only running and queued are active", () => {
    expect(ALL.filter(isActive)).toEqual(["running", "queued"])
  })
})

describe("byUrgency", () => {
  test("sorts failure, running, queued, cancelled, success, skipped, idle", () => {
    const shuffled: Status[] = [
      "idle",
      "success",
      "skipped",
      "queued",
      "failure",
      "cancelled",
      "running",
    ]

    expect(Array.sort(shuffled, byUrgency)).toEqual([
      "failure",
      "running",
      "queued",
      "cancelled",
      "success",
      "skipped",
      "idle",
    ])
  })
})

describe("aggregate", () => {
  test("failure wins, then running, then queued", () => {
    expect(aggregate(["success", "running", "failure"])).toBe("failure")
    expect(aggregate(["success", "queued", "running"])).toBe("running")
    expect(aggregate(["success", "queued"])).toBe("queued")
  })

  test("skipped parts don't hide a success", () => {
    expect(aggregate(["success", "skipped"])).toBe("success")
    expect(aggregate(["skipped", "skipped"])).toBe("skipped")
  })

  test("a cancelled part makes the whole cancelled", () => {
    expect(aggregate(["success", "cancelled"])).toBe("cancelled")
  })

  test("nothing is idle", () => {
    expect(aggregate([])).toBe("idle")
  })
})
