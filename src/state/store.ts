import { useSyncExternalStore } from "react";
import type { Job, RepoState } from "../core/types";

export type View = "dashboard" | "detail";
export type Focus = "repos" | "runs" | "jobs";

export interface JobsState {
  jobs: Job[];
  fetchedAt?: Date;
  error?: string;
}

export interface AppState {
  /** Keyed by `repoKey(repo)`. */
  repos: Record<string, RepoState>;
  /** Display order as configured; the UI sorts by urgency on top of it. */
  repoOrder: string[];
  /** Keyed by run id. */
  jobs: Record<string, JobsState>;
  view: View;
  focus: Focus;
  selectedRepo?: string;
  selectedRun?: string;
  selectedJob?: string;
  lastRefresh?: Date;
  themeName: string;
  error?: string;
  /** Set to request the app to exit with this code (used by `watch`). */
  exitCode?: number;
}

type Listener = () => void;

/** Tiny external store: plain object + subscribe, read from React with `useStore(selector)`. */
export interface Store<S> {
  get(): S;
  set(patch: Partial<S> | ((s: S) => Partial<S>)): void;
  subscribe(l: Listener): () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch) {
      const p = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...p };
      for (const l of listeners) l();
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const initialState = (themeName: string): AppState => ({
  repos: {},
  repoOrder: [],
  jobs: {},
  view: "dashboard",
  focus: "repos",
  themeName,
});

export type AppStore = Store<AppState>;

export function useStore<T>(store: AppStore, selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
