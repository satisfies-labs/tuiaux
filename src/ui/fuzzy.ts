const BOUNDARY = new Set([" ", "/", "-", "_", ".", "#", ":"])

const startsWord = (text: string, at: number): boolean => {
  const before = text[at - 1]

  return before === undefined || BOUNDARY.has(before)
}

/** Where each query letter lands; `eager` jumps ahead to a word start when the next letter isn't adjacent. */
const positions = (
  needle: string,
  haystack: string,
  eager: boolean,
): ReadonlyArray<number> | undefined => {
  const found: Array<number> = []
  let from = 0

  for (const char of needle) {
    const first = haystack.indexOf(char, from)

    if (first === -1) return undefined

    let at = first

    if (eager && first !== (found.at(-1) ?? -2) + 1)
      for (let i = first; i !== -1; i = haystack.indexOf(char, i + 1))
        if (startsWord(haystack, i)) {
          at = i
          break
        }

    found.push(at)
    from = at + 1
  }

  return found
}

/**
 * How well `query` matches `text` as a case-insensitive subsequence; undefined when it doesn't.
 * Letters at a word start and runs of contiguous letters score higher; shorter texts win ties.
 */
export const fuzzyScore = (query: string, text: string): number | undefined => {
  if (query === "") return 0

  const needle = query.toLowerCase()
  const haystack = text.toLowerCase()

  // Jumping to word starts can strand later letters; plain greedy always finds a subsequence if one exists.
  const found =
    positions(needle, haystack, true) ?? positions(needle, haystack, false)

  if (found === undefined) return undefined

  const score = found.reduce(
    (sum, at, index) =>
      sum +
      1 +
      (startsWord(haystack, at) ? 3 : 0) +
      (at === (found[index - 1] ?? -2) + 1 ? 2 : 0),
    0,
  )

  return score - text.length * 0.01
}
