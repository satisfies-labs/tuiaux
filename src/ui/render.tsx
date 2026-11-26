import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useState } from "react";
import type { Config } from "../config/schema";
import type { Poller } from "../services/poller";
import type { AppStore } from "../state/store";
import { resolveTheme, type TerminalColorsLike } from "../theme/resolve";
import { App, type Mode } from "./App";
import { AppProvider } from "./context";

export interface RenderOptions {
  store: AppStore;
  poller?: Poller;
  config: Config;
  mode?: Mode;
  themeName: string;
}

interface RootProps {
  opts: RenderOptions;
  terminal: TerminalColorsLike | undefined;
  quit: (code?: number) => void;
}

function Root({ opts, terminal, quit }: RootProps) {
  const [themeName, setThemeName] = useState(opts.themeName);
  const theme = resolveTheme(themeName, opts.config.theme.colors, terminal);
  return (
    <AppProvider value={{ store: opts.store, poller: opts.poller, theme, setTheme: setThemeName, quit }}>
      <App mode={opts.mode} />
    </AppProvider>
  );
}

/** Boot the OpenTUI renderer and mount the app. Resolves with the exit code when the user quits. */
export async function renderApp(opts: RenderOptions): Promise<number> {
  const renderer = await createCliRenderer({ exitOnCtrlC: false });

  // The `terminal` theme needs the real palette (OSC 4/10/11). Unsupported terminals → fallback colors.
  let terminal: TerminalColorsLike | undefined;
  try {
    terminal = await renderer.getPalette({ timeout: 300 });
  } catch {
    terminal = undefined;
  }

  return new Promise<number>((resolveExit) => {
    const quit = (code = 0) => {
      opts.poller?.stop();
      renderer.destroy();
      resolveExit(code);
    };

    createRoot(renderer).render(<Root opts={opts} terminal={terminal} quit={quit} />);
    opts.store.subscribe(() => {
      const exit = opts.store.get().exitCode;
      if (exit !== undefined) quit(exit);
    });
  });
}
