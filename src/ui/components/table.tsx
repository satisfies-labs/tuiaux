import type { ReactNode } from "react"

import type { ColorToken } from "../../platform"
import { type ColumnSpec, layoutColumns } from "../columns"
import { useText } from "../text"
import { useTheme } from "../theme"
import { visibleWindow } from "../window"

export interface Column<T> extends ColumnSpec {
  readonly header?: string | undefined
  readonly align?: "left" | "right" | undefined
  /** Fitted to the column and aligned. */
  readonly value: (row: T) => string
  /** Drawn instead of `value` (e.g. a progress bar); it must take exactly `width` cells. */
  readonly cell?: ((row: T, width: number) => ReactNode) | undefined
  readonly tone?: ((row: T) => ColorToken) | undefined
}

/** Marker, then the lead (a status dot) and its space. */
const LEAD = 3

/** Rows on a strict grid: columns sized by `layoutColumns`, the selected row marked and highlighted, scrolled to stay visible. */
export const Table = <T,>({
  columns,
  rows,
  rowKey,
  lead,
  selected,
  focused,
  width,
  height,
  header = false,
}: {
  readonly columns: ReadonlyArray<Column<T>>
  readonly rows: ReadonlyArray<T>
  readonly rowKey: (row: T) => string
  readonly lead: (row: T) => ReactNode
  readonly selected?: string | undefined
  readonly focused: boolean
  /** Inner width, in cells. */
  readonly width: number
  /** Rows available, the header included. */
  readonly height: number
  readonly header?: boolean | undefined
}) => {
  const theme = useTheme()
  const { fit } = useText()
  const widths = layoutColumns(columns, width - LEAD)

  const shown = columns.flatMap(column => {
    const cells = widths.get(column.id)

    return cells === undefined ? [] : [{ column, cells }]
  })

  const align = (text: string, cells: number, right: boolean) => {
    const fitted = fit(text, cells)

    return right ? fitted.trimEnd().padStart(cells) : fitted
  }

  const cursor = rows.findIndex(row => rowKey(row) === selected)
  const room = Math.max(0, height - (header ? 1 : 0))
  const { start, end } = visibleWindow(rows.length, cursor, room)

  return (
    <>
      {header && (
        <text wrapMode="none" fg={theme.muted}>
          {" ".repeat(LEAD)}
          {shown
            .map(({ column, cells }) =>
              align(column.header ?? "", cells, column.align === "right"),
            )
            .join(" ")}
        </text>
      )}
      {rows.slice(start, end).map(row => {
        const key = rowKey(row)
        const isSelected = key === selected

        return (
          <text
            key={key}
            wrapMode="none"
            bg={isSelected ? theme.selection : undefined}
          >
            <span fg={theme.accent}>{isSelected && focused ? "▌" : " "}</span>
            {lead(row)}{" "}
            {shown.map(({ column, cells }, index) => {
              const gap = index === shown.length - 1 ? "" : " "

              return column.cell === undefined ? (
                <span key={column.id} fg={theme[column.tone?.(row) ?? "text"]}>
                  {align(column.value(row), cells, column.align === "right") +
                    gap}
                </span>
              ) : (
                <span key={column.id}>
                  {column.cell(row, cells)}
                  {gap}
                </span>
              )
            })}
          </text>
        )
      })}
    </>
  )
}
