import { describe, expect, test } from "bun:test"
import { Duration, Option } from "effect"

import {
  applyFilter,
  groupByProvider,
  runStats,
  tally,
} from "../../src/features/dashboard/model"
import { moveBy } from "../../src/ui"
import { entry } from "../support/app"
import { T0, repo, run } from "../support/domain"

const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)

describe("groupByProvider", () => {
  test("groups by kind, in order of first appearance", () => {
    const groups = groupByProvider([
      entry({ repo: repo("a/gl", "gitlab") }),
      entry({ repo: repo("a/gh") }),
      entry({ repo: repo("b/gl", "gitlab") }),
    ])

    expect(groups.map(g => [g.kind, g.repos.map(e => e.repo.path)])).toEqual([
      ["gitlab", ["a/gl", "b/gl"]],
      ["github", ["a/gh"]],
    ])
  })
})

describe("moveBy", () => {
  test("steps through keys and stops at both ends", () => {
    const keys = ["a", "b", "c"]

    expect(moveBy(keys, "a", 1)).toBe("b")
    expect(moveBy(keys, "c", 1)).toBe("c")
    expect(moveBy(keys, "a", -1)).toBe("a")
    expect(moveBy(keys, undefined, 1)).toBe("b")
    expect(moveBy([], undefined, 1)).toBeUndefined()
  })
})

describe("tally", () => {
  test("counts repos by the tone of their latest run", () => {
    expect(
      tally([
        entry({
          runs: [run({ status: "failure" }), run({ status: "success" })],
        }),
        entry({ runs: [run({ status: "queued" })] }),
        entry({ runs: [] }),
      ]),
    ).toEqual({ success: 0, running: 0, failure: 1, idle: 2 })
  })
})

describe("runStats", () => {
  test("average duration and success rate of settled runs", () => {
    const stats = runStats([
      run({ status: "running", startedAt: at(0) }),
      run({ status: "success", startedAt: at(0), finishedAt: at(2) }),
      run({ status: "failure", startedAt: at(0), finishedAt: at(4) }),
      run({ status: "cancelled", startedAt: at(0), finishedAt: at(6) }),
    ])

    expect(Option.map(stats.average, Duration.toMinutes)).toEqual(
      Option.some(4),
    )
    expect(stats.okRatio).toEqual(Option.some(0.5))
  })

  test("nothing to say about runs that never settled", () => {
    expect(runStats([run({ status: "running" })])).toEqual({
      average: Option.none(),
      okRatio: Option.none(),
    })
  })
})

describe("applyFilter", () => {
  const failing = entry({
    repo: repo("acme/web"),
    runs: [run({ status: "failure" })],
  })

  const repos = [entry({ repo: repo("acme/api") }), failing]

  test("keeps the repos whose path matches the query", () => {
    expect(
      applyFilter(repos, { query: "web", failingOnly: false }).map(
        e => e.repo.path,
      ),
    ).toEqual(["acme/web"])
  })

  test("failing only keeps red repos; an empty filter keeps all", () => {
    expect(applyFilter(repos, { query: "", failingOnly: true })).toEqual([
      failing,
    ])
    expect(applyFilter(repos, { query: "", failingOnly: false })).toEqual(repos)
  })
})
