/**
 * Exactly `width` columns: cut with "…" when too long, padded when short. Keeps rows on the grid.
 * shortcut: counts UTF-16 units, not terminal cells; switch to a cell-width count if wide glyphs show up.
 */
export const fit = (text: string, width: number): string =>
  text.length > width
    ? `${text.slice(0, Math.max(0, width - 1))}…`
    : text.padEnd(width)

/** `1 repo`, `3 repos`. */
export const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`
