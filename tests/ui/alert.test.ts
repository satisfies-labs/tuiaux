import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { type AlertTarget, alert, osc9, sanitize } from "../../src/ui"

const notification = { title: "acme/api", body: "CI #412 failed on main" }

/** A renderer that may or may not show notifications itself, recording what was written next to it. */
const terminal = (supportsNotifications: boolean) => {
  const written: Array<string> = []
  const shown: Array<string> = []

  const renderer: AlertTarget = {
    idle: () => Promise.resolve(),
    triggerNotification: (message, title) => {
      if (supportsNotifications) shown.push(`${title}: ${message}`)

      return supportsNotifications
    },
  }

  return {
    written,
    shown,
    ring: (bell: boolean) =>
      Effect.runPromise(
        alert(renderer, bytes => void written.push(bytes), notification, bell),
      ),
  }
}

describe("sanitize", () => {
  test("drops control characters, escape and bell included", () => {
    expect(sanitize("feat\x1b]0;pwned\x07\nnext")).toBe("feat ]0;pwned  next")
  })
})

describe("osc9", () => {
  test("title and body in one OSC 9 sequence, ended by BEL", () => {
    expect(osc9(notification)).toBe(
      "\x1b]9;acme/api: CI #412 failed on main\x07",
    )
  })

  test("a branch name can't smuggle its own sequence", () => {
    const sequence = osc9({ title: "x", body: "on \x1b]52;c;Zm9v\x07" })

    expect(sequence.slice(4, -1)).not.toContain("\x1b")
    expect(sequence.slice(4, -1)).not.toContain("\x07")
  })
})

describe("alert", () => {
  test("OSC 9 and the bell when the terminal can't notify through OpenTUI", async () => {
    const term = terminal(false)

    await term.ring(true)

    expect(term.written).toEqual([`${osc9(notification)}\x07`])
  })

  test("OpenTUI's notification replaces OSC 9 where supported (kitty)", async () => {
    const term = terminal(true)

    await term.ring(true)

    expect(term.shown).toEqual(["acme/api: CI #412 failed on main"])
    expect(term.written).toEqual(["\x07"])
  })

  test("no bell when it's turned off", async () => {
    const term = terminal(true)

    await term.ring(false)

    expect(term.written).toEqual([])
  })
})
