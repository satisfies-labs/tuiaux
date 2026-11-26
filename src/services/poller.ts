import type { Config } from "../config/schema";
import { isActive } from "../core/status";
import { type RepoRef, type Run, repoKey } from "../core/types";
import type { ProviderRegistry } from "../providers/registry";
import { viewModel } from "../state/selectors";
import type { AppStore } from "../state/store";
import { logger } from "./logger";

export interface PollTarget {
  repo: RepoRef;
  branch?: string;
}

export interface PollerEvents {
  /** A run went from running/queued to a final state. */
  onRunSettled?: (run: Run, previous: Run | undefined) => void;
}

const CONCURRENCY = 4;
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Owns all network activity. Fetches runs for every target, jobs for the selected run,
 * adapts its pace (fast while something runs, slow when idle) and backs off per repo on errors.
 */
export class Poller {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private failures = new Map<string, number>();
  private nextAllowed = new Map<string, number>();

  constructor(
    private readonly store: AppStore,
    private readonly registry: ProviderRegistry,
    private readonly targets: PollTarget[],
    private readonly config: Config,
    private readonly events: PollerEvents = {},
  ) {
    store.set({
      repoOrder: targets.map((t) => repoKey(t.repo)),
      repos: Object.fromEntries(
        targets.map((t) => [repoKey(t.repo), { repo: t.repo, runs: [], branch: t.branch }]),
      ),
    });
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    void this.loop();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Skip the wait and poll now (the `r` key). */
  refreshNow() {
    this.nextAllowed.clear();
    if (this.timer) clearTimeout(this.timer);
    void this.loop();
  }

  private async loop() {
    if (this.stopped) return;
    try {
      await this.tick();
    } catch (e) {
      logger.error("poll tick failed", e);
    }
    if (this.stopped) return;
    const active = Object.values(this.store.get().repos).some((r) =>
      r.runs.some((run) => isActive(run.status)),
    );
    const delay = (active ? this.config.refresh.active : this.config.refresh.idle) * 1000;
    this.timer = setTimeout(() => void this.loop(), delay);
  }

  async tick() {
    const queue = [...this.targets];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let t = queue.shift(); t; t = queue.shift()) await this.pollRepo(t);
    });
    await Promise.all(workers);
    await this.pollSelectedJobs();
    this.store.set({ lastRefresh: new Date() });
  }

  private async pollRepo(t: PollTarget) {
    const key = repoKey(t.repo);
    if ((this.nextAllowed.get(key) ?? 0) > Date.now()) return;
    try {
      const provider = await this.registry.for(t.repo);
      const runs = await provider.listRuns(t.repo, { branch: t.branch, limit: 20 });
      const prev = this.store.get().repos[key];
      this.detectTransitions(prev?.runs ?? [], runs);
      this.failures.delete(key);
      this.store.set((s) => ({
        repos: { ...s.repos, [key]: { repo: t.repo, branch: t.branch, runs, lastFetchedAt: new Date() } },
      }));
    } catch (e) {
      const n = (this.failures.get(key) ?? 0) + 1;
      this.failures.set(key, n);
      const backoff = Math.min(MAX_BACKOFF_MS, 2 ** n * 5_000);
      this.nextAllowed.set(key, Date.now() + backoff);
      const message = (e as Error).message;
      logger.warn(`poll ${key} failed (retry in ${backoff / 1000}s)`, message);
      this.store.set((s) => {
        const current = s.repos[key] ?? { repo: t.repo, runs: [] };
        return { repos: { ...s.repos, [key]: { ...current, error: message } } };
      });
    }
  }

  private async pollSelectedJobs() {
    const s = this.store.get();
    const { repo, run } = viewModel(s);
    if (!repo || !run) return;
    const cached = s.jobs[run.id];
    if (cached?.fetchedAt && !isActive(run.status) && cached.jobs.length > 0) return; // settled runs never change
    try {
      const provider = await this.registry.for(repo.repo);
      const jobs = await provider.listJobs(repo.repo, run.id);
      this.store.set((st) => ({ jobs: { ...st.jobs, [run.id]: { jobs, fetchedAt: new Date() } } }));
    } catch (e) {
      this.store.set((st) => ({ jobs: { ...st.jobs, [run.id]: { jobs: [], error: (e as Error).message } } }));
    }
  }

  private detectTransitions(before: Run[], after: Run[]) {
    if (!this.events.onRunSettled) return;
    for (const run of after) {
      const prev = before.find((r) => r.id === run.id);
      if (prev && isActive(prev.status) && !isActive(run.status)) this.events.onRunSettled(run, prev);
    }
  }
}
