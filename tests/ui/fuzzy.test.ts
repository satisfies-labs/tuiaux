import { expect, test } from "bun:test"

import { fuzzyScore } from "../../src/ui"

const score = (query: string, text: string) => fuzzyScore(query, text) ?? -1

test("word starts and contiguous letters rank higher", () => {
  expect(score("ci", "CI #412")).toBeGreaterThan(score("ci", "pick it"))
  expect(score("fr", "Forget repo")).toBeGreaterThan(score("fr", "fix: drift"))
})

test("a query that isn't a subsequence doesn't match", () => {
  expect(fuzzyScore("xyz", "CI")).toBeUndefined()
  expect(fuzzyScore("ptf", "portfolio")).toBeDefined()
})

test("an empty query matches everything with the same score", () => {
  expect(fuzzyScore("", "anything")).toBe(0)
})

test("jumping to a word start never loses a match", () => {
  expect(fuzzyScore("ro", "xro r")).toBeDefined()
})
