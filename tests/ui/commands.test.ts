import { describe, expect, test } from "bun:test"

import { type Command, keyLabel, matchKey } from "../../src/ui"

const command = (id: string, keys: ReadonlyArray<string>): Command => ({
  id,
  title: id,
  group: "Actions",
  keys,
  run: () => {},
})

const key = (name: string, sequence = name, ctrl = false) => ({
  name,
  sequence,
  ctrl,
})

const commands = [
  command("down", ["j", "down"]),
  command("help", ["?"]),
  command("palette", ["ctrl+k"]),
  command("up", ["k"]),
  command("other-j", ["j"]),
]

describe("matchKey", () => {
  test("matches by name or by sequence", () => {
    expect(matchKey(commands, key("j"))?.id).toBe("down")
    expect(matchKey(commands, key("down", "\u001B[B"))?.id).toBe("down")
    expect(matchKey(commands, key("slash", "?"))?.id).toBe("help")
  })

  test("ctrl keys match only with ctrl, plain keys only without", () => {
    expect(matchKey(commands, key("k", "\u000B", true))?.id).toBe("palette")
    expect(matchKey(commands, key("k"))?.id).toBe("up")
    expect(matchKey(commands, key("j", "\n", true))).toBeUndefined()
  })

  test("the first command wins", () => {
    expect(matchKey(commands, key("j"))?.id).toBe("down")
  })
})

test("keyLabel", () => {
  expect(keyLabel("return")).toBe("⏎")
  expect(keyLabel("escape")).toBe("esc")
  expect(keyLabel("ctrl+k")).toBe("^K")
  expect(keyLabel("down")).toBe("↓")
  expect(keyLabel("w")).toBe("w")
})
