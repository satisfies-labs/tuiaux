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
