import { describe, expect, test } from "bun:test"
import { Option } from "effect"

import type { Run } from "../../src/domain"
import { notificationFor } from "../../src/monitor"
import { run } from "../support/domain"

const settled = (status: Run["status"], previous?: Run["status"]) => ({
  run: run({ status, workflow: "CI", number: 412, branch: "main" }),
  previous: previous === undefined ? undefined : run({ status: previous }),
})

const body = (notification: ReturnType<typeof notificationFor>) =>
  Option.map(notification, each => each.body)

describe("notificationFor", () => {
  test("a failure, when failures are wanted", () => {
    expect(body(notificationFor(settled("failure"), ["failure"]))).toEqual(
      Option.some("CI #412 failed on main"),
    )
    expect(notificationFor(settled("failure"), ["success"])).toEqual(
      Option.none(),
    )
  })

  test("a success after a failure is a recovery", () => {
    expect(
      body(notificationFor(settled("success", "failure"), ["recovered"])),
    ).toEqual(Option.some("CI #412 is green again on main"))
  })

  test("a plain success only when successes are wanted", () => {
    expect(
      notificationFor(settled("success", "success"), ["failure", "recovered"]),
    ).toEqual(Option.none())
    expect(body(notificationFor(settled("success"), ["success"]))).toEqual(
      Option.some("CI #412 passed on main"),
    )
  })

  test("wanting successes includes recoveries", () => {
    expect(
      Option.isSome(
        notificationFor(settled("success", "failure"), ["success"]),
      ),
    ).toBe(true)
  })

  test("cancelled or skipped runs are never worth a notification", () => {
    const all = ["failure", "success", "recovered"] as const

    expect(notificationFor(settled("cancelled"), all)).toEqual(Option.none())
    expect(notificationFor(settled("skipped"), all)).toEqual(Option.none())
  })

  test("titled with the repo", () => {
    expect(
      Option.map(
        notificationFor(settled("failure"), ["failure"]),
        each => each.title,
      ),
    ).toEqual(Option.some("acme/api"))
  })
})
