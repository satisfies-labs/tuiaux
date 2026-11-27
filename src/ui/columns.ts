/** A table column's sizing: fixed `width`, or `flex` taking what's left (at least `min`). */
export interface ColumnSpec {
  readonly id: string
  readonly width: number
  readonly flex?: boolean | undefined
  readonly min?: number | undefined
  /** Higher survives longer when the table is too narrow. */
  readonly priority: number
}

const DEFAULT_MIN = 8

const needed = (columns: ReadonlyArray<ColumnSpec>): number =>
  columns.reduce(
    (sum, column) =>
      sum + (column.flex === true ? (column.min ?? DEFAULT_MIN) : column.width),
    columns.length - 1,
  )

/** Widths of the columns that fit in `width` cells (one-cell gaps between them), in column order; the lowest priorities go first. */
export const layoutColumns = (
  columns: ReadonlyArray<ColumnSpec>,
  width: number,
): ReadonlyMap<string, number> => {
  let kept = columns

  while (needed(kept) > width && kept.length > 1) {
    const lowest = kept.toSorted((a, b) => a.priority - b.priority)[0]

    kept = kept.filter(column => column !== lowest)
  }

  const fixed = kept.reduce(
    (sum, column) => sum + (column.flex === true ? 0 : column.width),
    kept.length - 1,
  )

  return new Map(
    kept.map(column => [
      column.id,
      column.flex === true ? Math.max(0, width - fixed) : column.width,
    ]),
  )
}
