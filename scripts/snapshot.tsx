/**
 * Render the UI with demo data into plain text frames (no terminal needed).
 * Usage: bun run snapshot [dashboard|detail|watch] [cols] [rows]
 * Handy to review layout changes in PRs or to regenerate docs/design/*.txt.
 */
import { testRender } from "@opentui/react/test-utils";
import { defaultConfig } from "../src/config";
import { demoRepos } from "../src/providers/demo";
import { ProviderRegistry } from "../src/providers/registry";
import { Poller } from "../src/services/poller";
import { createStore, initialState } from "../src/state/store";
import { resolveTheme } from "../src/theme";
import { App } from "../src/ui/App";
import { AppProvider } from "../src/ui/context";

// OpenTUI renders outside React's act(): drop those test-only warnings.
const origError = console.error;
console.error = (...a: unknown[]) => {
  if (!String(a[0]).includes("act(")) origError(...a);
};

const [view = "dashboard", cols, rows] = Bun.argv.slice(2);
const width = Number(cols ?? (view === "watch" ? 62 : 132));
const height = Number(rows ?? (view === "watch" ? 9 : 40));

const config = defaultConfig();
const store = createStore(initialState("tuiaux-dark"));
const targets = demoRepos().map((repo) => ({ repo }));
const poller = new Poller(
  store,
  new ProviderRegistry(config, true),
  view === "watch" ? targets.slice(0, 1) : targets,
  config,
);
await poller.tick();
if (view === "detail") {
  store.set({ view: "detail" });
  await poller.tick();
}

const t = await testRender(
  <AppProvider
    value={{ store, poller, theme: resolveTheme("tuiaux-dark"), setTheme: () => {}, quit: () => {} }}
  >
    <App mode={view === "watch" ? "watch" : "dashboard"} />
  </AppProvider>,
  { width, height },
);
await t.renderOnce();
process.stdout.write(`${t.captureCharFrame()}\n`);
await t.dispose();
process.exit(0);
