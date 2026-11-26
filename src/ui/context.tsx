import { createContext, type ReactNode, useContext } from "react";
import type { Poller } from "../services/poller";
import type { AppStore } from "../state/store";
import type { Theme } from "../theme/resolve";

export interface AppContextValue {
  store: AppStore;
  poller?: Poller;
  theme: Theme;
  setTheme: (name: string) => void;
  quit: (code?: number) => void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp() outside <AppProvider>");
  return v;
}

export const useTheme = () => useApp().theme;
