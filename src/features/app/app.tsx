import { Atom } from "effect/reactivity"

import { RegistryProvider, useAtom } from "@effect/atom-react"
import { useKeyboard } from "@opentui/react"

import {
  AppContext,
  type AppHandle,
  type Theme,
  ThemeContext,
  useApp,
  useMonitorState,
  useTheme,
} from "../../ui"
import { DASHBOARD_HINTS, Dashboard } from "../dashboard/dashboard"
import { ConfigIssues } from "./config-issues"
import { Header } from "./header"
import { Help } from "./help"
import { StatusLine } from "./status-line"

/** At most one dialog at a time; config issues open first, when there are any. */
const overlayAtom = Atom.make<"issues" | "help" | undefined>("issues")

export const App = () => {
  const app = useApp()
  const theme = useTheme()
  const state = useMonitorState()
  const [opened, setOverlay] = useAtom(overlayAtom)

  const overlay =
    opened === "issues" && app.configIssues.length === 0 ? undefined : opened

  useKeyboard(key => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) return app.quit()

    if (overlay !== undefined) {
      if (["escape", "return"].includes(key.name) || key.sequence === "?")
        setOverlay(undefined)

      return
    }

    if (key.sequence === "?") setOverlay("help")
    else if (key.name === "r") app.run(monitor => monitor.refresh)
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.bg}
    >
      <Header version={app.version} />
      <Dashboard state={state} active={overlay === undefined} />
      <StatusLine issues={state.hostIssues} hints={DASHBOARD_HINTS} />
      {overlay === "issues" && (
        <ConfigIssues path={app.configPath} issues={app.configIssues} />
      )}
      {overlay === "help" && <Help hints={DASHBOARD_HINTS} />}
    </box>
  )
}

/** Everything the app needs from outside React: its handle, its theme, an atom registry. */
export const Root = ({
  app,
  theme,
}: {
  readonly app: AppHandle
  readonly theme: Theme
}) => (
  <RegistryProvider>
    <AppContext value={app}>
      <ThemeContext value={theme}>
        <App />
      </ThemeContext>
    </AppContext>
  </RegistryProvider>
)
