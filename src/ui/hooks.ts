import { useEffect, useState } from "react";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Shared spinner frame for running statuses (one timer, ~10 fps). */
export function useSpinner(enabled = true): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setI((n) => (n + 1) % SPINNER.length), 100);
    return () => clearInterval(t);
  }, [enabled]);
  return SPINNER[i] ?? "◌";
}

/** Re-render every `ms` so relative ages ("12m") stay fresh. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
