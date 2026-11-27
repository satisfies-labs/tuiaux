import { createContext, useContext } from "react"

import { type WidthMethod, measureEditText } from "@opentui/core"

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** Text measured in terminal cells, exactly as the renderer lays it out. */
export interface TextMeasure {
  /** Cells taken by `text`. */
  readonly width: (text: string) => number
  /** Exactly `cells` wide: cut with "…" when too long, padded when short. Keeps rows on the grid. */
  readonly fit: (text: string, cells: number) => string
}

/** OpenTUI's own measure under the terminal's width method: emoji and CJK take two cells. */
export const textMeasure = (widthMethod: WidthMethod): TextMeasure => {
  const width = (text: string) => measureEditText(text, { widthMethod })

  return {
    width,
    fit: (text, cells) => {
      if (width(text) <= cells) return text + " ".repeat(cells - width(text))

      // Keep whole graphemes (an emoji, a letter with its accent) while they fit before the "…".
      let kept = ""

      for (const { segment } of graphemes.segment(text)) {
        if (width(kept + segment) > cells - 1) break
        kept += segment
      }

      return `${kept}…${" ".repeat(cells - 1 - width(kept))}`
    },
  }
}

export const TextContext = createContext<TextMeasure>(textMeasure("unicode"))

export const useText = (): TextMeasure => useContext(TextContext)

/** `1 repo`, `3 repos`. */
export const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`
