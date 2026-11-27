/** A slice of a list: items from `start` (included) to `end` (excluded). */
export interface Slice {
  readonly start: number
  readonly end: number
}

/** The `size` items to draw from a list of `length`, scrolled so `cursor` stays visible (and centered). */
export const visibleWindow = (
  length: number,
  cursor: number,
  size: number,
): Slice => {
  if (length <= size) return { start: 0, end: length }

  const start = Math.min(
    Math.max(0, cursor - Math.floor(size / 2)),
    length - size,
  )

  return { start, end: start + size }
}

/** The key `delta` steps away from `current` in `keys`, clamped to the ends. */
export const moveBy = <K>(
  keys: ReadonlyArray<K>,
  current: K | undefined,
  delta: number,
): K | undefined => {
  const index = current === undefined ? 0 : Math.max(0, keys.indexOf(current))

  return keys[Math.min(keys.length - 1, Math.max(0, index + delta))]
}
