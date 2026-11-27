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
import { Dashboard } from "../dashboard/dashboard"
import { ConfigIssues } from "./config-issues"
import { Header } from "./header"
import { StatusLine } from "./status-line"

const configIssuesOpen = Atom.make(true)

export const App = () => {
  const app = useApp()
  const theme = useTheme()
  const state = useMonitorState()
  const [issuesOpen, setIssuesOpen] = useAtom(configIssuesOpen)
  const showIssues = issuesOpen && app.configIssues.length > 0

  useKeyboard(key => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) app.quit()
    else if (showIssues) {
      if (key.name === "escape" || key.name === "return") setIssuesOpen(false)
    } else if (key.name === "r") app.run(monitor => monitor.refresh)
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.bg}
    >
      <Header version={app.version} />
      <box flexGrow={1} flexDirection="column" paddingX={1} paddingY={1}>
        <Dashboard state={state} />
      </box>
      <StatusLine issues={state.hostIssues} />
      {showIssues && (
        <ConfigIssues path={app.configPath} issues={app.configIssues} />
      )}
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
