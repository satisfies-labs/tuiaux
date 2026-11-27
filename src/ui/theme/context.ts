import { createContext, useContext } from "react"

import { type Theme, resolveTheme } from "./resolve"

export const ThemeContext = createContext<Theme>(
  resolveTheme("tuiaux-dark", {}, undefined),
)

export const useTheme = (): Theme => useContext(ThemeContext)
