import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { repoKey } from "../core/types";
import { openUrl } from "../services/open";
import { step, viewModel } from "../state/selectors";
import { useStore } from "../state/store";
import { THEME_NAMES } from "../theme/themes";
import { Header } from "./components/Header";
import { useApp } from "./context";
import { Dashboard } from "./views/Dashboard";
import { RunDetail } from "./views/RunDetail";
import { Watch } from "./views/Watch";

export type Mode = "dashboard" | "watch";

export function App({ mode = "dashboard" }: { mode?: Mode }) {
  const { store, poller, theme, setTheme, quit } = useApp();
  const state = useStore(store, (s) => s);
  const vm = viewModel(state);
  const { width } = useTerminalDimensions();

  useKeyboard((key) => {
    const s = store.get();
    if (key.name === "q" || (key.ctrl && key.name === "c")) return quit(0);
    if (key.name === "r") return poller?.refreshNow();
    if (key.name === "t") {
      const i = THEME_NAMES.indexOf(theme.name as (typeof THEME_NAMES)[number]);
      return setTheme(THEME_NAMES[(i + 1) % THEME_NAMES.length] ?? "terminal");
    }
    if (key.name === "o") {
      const url = s.view === "detail" ? (vm.job?.url ?? vm.run?.url) : vm.run?.url;
      if (url) void openUrl(url);
      return;
    }
    if (mode === "watch") return;

    if (s.view === "detail") {
      if (key.name === "escape" || key.name === "backspace") return store.set({ view: "dashboard" });
      const delta =
        key.name === "down" || key.name === "j" ? 1 : key.name === "up" || key.name === "k" ? -1 : 0;
      if (delta)
        store.set({
          selectedJob: step(
            vm.jobs.map((j) => j.id),
            vm.job?.id,
            delta,
          ),
        });
      return;
    }

    if (key.name === "tab") {
      const order = ["repos", "runs", "jobs"] as const;
      const i = order.indexOf(s.focus);
      return store.set({ focus: order[(i + (key.shift ? 2 : 1)) % 3] });
    }
    if (key.name === "return")
      return vm.run && store.set({ view: "detail", selectedRun: vm.run.id, selectedJob: undefined });

    const delta =
      key.name === "down" || key.name === "j" ? 1 : key.name === "up" || key.name === "k" ? -1 : 0;
    if (!delta) return;
    if (s.focus === "repos") {
      const next = step(
        vm.repos.map((r) => repoKey(r.repo)),
        vm.repo && repoKey(vm.repo.repo),
        delta,
      );
      store.set({ selectedRepo: next, selectedRun: undefined, selectedJob: undefined });
      poller?.refreshNow();
    } else if (s.focus === "runs") {
      store.set({
        selectedRun: step(
          vm.runs.map((r) => r.id),
          vm.run?.id,
          delta,
        ),
        selectedJob: undefined,
      });
      poller?.refreshNow();
    } else {
      store.set({
        selectedJob: step(
          vm.jobs.map((j) => j.id),
          vm.job?.id,
          delta,
        ),
      });
    }
  });

  if (mode === "watch") {
    return (
      <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.bg}>
        <Watch vm={vm} width={width} />
      </box>
    );
  }

  const crumbs =
    state.view === "detail" && vm.run && vm.repo
      ? [vm.repo.repo.path, `${vm.run.workflow} #${vm.run.number}`]
      : undefined;
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.bg}
      paddingLeft={1}
      paddingRight={1}
    >
      <Header repos={vm.repos} lastRefresh={state.lastRefresh} crumbs={crumbs} />
      {state.view === "detail" ? (
        <RunDetail vm={vm} />
      ) : (
        <Dashboard vm={vm} focus={state.focus} width={width} />
      )}
    </box>
  );
}
