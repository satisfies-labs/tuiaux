import { useEffect } from "react"

import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useKeyboard } from "@opentui/react"

import {
  AppContext,
  type AppHandle,
  type Command,
  GlobalCommandsContext,
  Overlay,
  TextContext,
  type TextMeasure,
  type Theme,
  ThemeContext,
  View,
  describeIssue,
  flashAtom,
  overlayAtom,
  useApp,
  useMonitorState,
  useTheme,
  viewAtom,
} from "../../ui"
import { Dashboard } from "../dashboard/dashboard"
import { RunDetail } from "../run-detail/run-detail"
import { Watch } from "../watch/watch"
import { Header } from "./header"

export const App = () => {
  const app = useApp()
  const theme = useTheme()
  const state = useMonitorState()
  const view = useAtomValue(viewAtom)
  const setOverlay = useAtomSet(overlayAtom)
  const setFlash = useAtomSet(flashAtom)

  // Config problems are shown once, first; the app runs on defaults meanwhile.
  useEffect(() => {
    if (app.configIssues.length > 0)
      setOverlay(
        Overlay.Notice({
          title: "config.toml",
          lines: [
            app.configPath,
            ...app.configIssues.map(i => `• ${describeIssue(i)}`),
          ],
        }),
      )
  }, [app, setOverlay])

  // Ctrl-C quits from anywhere, even with an overlay open.
  useKeyboard(key => {
    if (key.ctrl && key.name === "c") app.quit()
  })

  const globals: ReadonlyArray<Command> = [
    {
      id: "app.refresh",
      title: "Refresh now",
      group: "Actions",
      keys: ["r"],
      hint: "refresh",
      run: () => {
        setFlash("↻ refreshing…")
        app.run(monitor => monitor.refresh)
      },
    },
    {
      id: "app.help",
      title: "Keys",
      group: "Actions",
      keys: ["?"],
      hint: "help",
      palette: false,
      run: () => setOverlay(Overlay.Palette()),
    },
    {
      id: "app.quit",
      title: "Quit",
      group: "Actions",
      keys: ["q"],
      hint: "quit",
      run: app.quit,
    },
  ]

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.bg}
    >
      <Header version={app.version} />
      <GlobalCommandsContext value={globals}>
        {View.$match(view, {
          Dashboard: () => <Dashboard state={state} />,
          RunDetail: ({ run }) => <RunDetail state={state} target={run} />,
          Watch: ({ run }) => <Watch state={state} target={run} />,
        })}
      </GlobalCommandsContext>
    </box>
  )
}

/** Everything the app needs from outside React: its handle, its theme, how the renderer measures text. */
export const Root = ({
  app,
  theme,
  text,
}: {
  readonly app: AppHandle
  readonly theme: Theme
  readonly text: TextMeasure
}) => (
  <RegistryProvider>
    <AppContext value={app}>
      <ThemeContext value={theme}>
        <TextContext value={text}>
          <App />
        </TextContext>
      </ThemeContext>
    </AppContext>
  </RegistryProvider>
)
