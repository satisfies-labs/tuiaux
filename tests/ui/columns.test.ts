import { expect, test } from "bun:test"

import { type ColumnSpec, layoutColumns } from "../../src/ui"

const runs: ReadonlyArray<ColumnSpec> = [
  { id: "workflow", width: 10, priority: 9 },
  { id: "number", width: 5, priority: 6 },
  { id: "commit", width: 0, flex: true, min: 12, priority: 10 },
  { id: "branch", width: 10, priority: 4 },
  { id: "event", width: 8, priority: 2 },
  { id: "time", width: 8, priority: 8 },
  { id: "age", width: 4, priority: 7 },
]

const total = (widths: ReadonlyMap<string, number>) =>
  [...widths.values()].reduce((sum, w) => sum + w, 0) + widths.size - 1

test("wide enough: every column, the flex one takes the rest", () => {
  const widths = layoutColumns(runs, 100)

  expect(widths.size).toBe(7)
  expect(widths.get("commit")).toBe(49)
  expect(total(widths)).toBe(100)
})

test("narrower: the lowest priorities go first, time is kept whole", () => {
  const at60 = layoutColumns(runs, 60)

  expect(at60.has("event")).toBe(false)
  expect(at60.has("branch")).toBe(true)
  expect(total(at60)).toBe(60)

  const at50 = layoutColumns(runs, 50)

  expect(at50.has("branch")).toBe(false)
  expect(at50.get("time")).toBe(8)
  expect(total(at50)).toBe(50)
})

test("without a flex column, columns keep their width", () => {
  const widths = layoutColumns(
    [
      { id: "a", width: 4, priority: 2 },
      { id: "b", width: 4, priority: 1 },
    ],
    6,
  )

  expect([...widths]).toEqual([["a", 4]])
})
