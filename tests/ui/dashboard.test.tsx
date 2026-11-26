import { afterEach, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { defaultConfig } from "../../src/config";
import { createDemoProvider, demoRepos } from "../../src/providers/demo";
import { ProviderRegistry } from "../../src/providers/registry";
import { Poller } from "../../src/services/poller";
import { createStore, initialState } from "../../src/state/store";
import { resolveTheme } from "../../src/theme";
import { App } from "../../src/ui/App";
import { AppProvider } from "../../src/ui/context";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
  await dispose?.();
  dispose = undefined;
});

async function setup(width = 132, height = 40) {
  const config = defaultConfig();
  const store = createStore(initialState("tuiaux-dark"));
  const poller = new Poller(
    store,
    new ProviderRegistry(config, true),
    demoRepos().map((repo) => ({ repo })),
    config,
  );
  await poller.tick();
  const theme = resolveTheme("tuiaux-dark");
  const t = await testRender(
    <AppProvider value={{ store, poller, theme, setTheme: () => {}, quit: () => {} }}>
      <App />
    </AppProvider>,
    { width, height, kittyKeyboard: true },
  );
  dispose = t.dispose;
  await t.renderOnce();
  return { ...t, store };
}

test("dashboard renders repos, runs and jobs from the demo provider", async () => {
  const { captureCharFrame } = await setup();
  const frame = captureCharFrame();
  expect(frame).toContain("tuiaux");
  expect(frame).toContain("Repos");
  expect(frame).toContain("acme/api");
  expect(frame).toContain("Runs · acme/api"); // failing repo is selected first (sorted by urgency)
  expect(frame).toContain("Jobs · CI #412");
  expect(frame).toContain("pipelines");
});

test("enter opens the run detail, esc goes back", async () => {
  const { mockInput, renderOnce, captureCharFrame, store, waitFor } = await setup();
  mockInput.pressEnter();
  await renderOnce();
  expect(store.get().view).toBe("detail");
  expect(captureCharFrame()).toContain("Log ·");
  mockInput.pressEscape();
  await waitFor(() => store.get().view === "dashboard");
  expect(store.get().view).toBe("dashboard");
});

test("demo provider evolves over time", async () => {
  let now = 0;
  const p = createDemoProvider(() => now);
  const repo = demoRepos()[0];
  if (!repo) throw new Error("no demo repo");
  expect((await p.listRuns(repo))[0]?.status).toBe("running");
  now = 10 * 60_000;
  expect((await p.listRuns(repo))[0]?.status).toBe("success");
});
