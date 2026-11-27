import { expect, test } from "bun:test"

import { type Navigation, View, back, go } from "../../src/ui"
import { runRef } from "../support/domain"

const start: Navigation = {
  view: View.Dashboard(),
  history: [],
  lastRun: undefined,
}

const run = runRef("12")

test("going to a run remembers it and where we came from", () => {
  const next = go(start, View.RunDetail({ run }))

  expect(next.lastRun).toBe(run)
  expect(next.history).toEqual([View.Dashboard()])
})

test("back returns to the previous view, then to the dashboard", () => {
  const deep = go(go(start, View.RunDetail({ run })), View.Watch({ run }))

  expect(back(deep).view).toEqual(View.RunDetail({ run }))
  expect(back(back(back(deep))).view).toEqual(View.Dashboard())
})

test("going to the view on show changes nothing", () => {
  expect(go(start, View.Dashboard())).toBe(start)
})

test("history keeps the last 10 views", () => {
  let nav = start

  for (let i = 0; i < 15; i++)
    nav = go(nav, View.RunDetail({ run: runRef(String(i)) }))

  expect(nav.history).toHaveLength(10)
})
