import { Order, Schema } from "effect";

/** Lifecycle status of a run, job or step, normalized across providers. */
export const Status = Schema.Literals([
  "success",
  "failure",
  "running",
  "queued",
  "cancelled",
  "skipped",
  "idle",
]);
export type Status = typeof Status.Type;

/** The four visual tones of the brand. Every Status maps to exactly one tone. */
export const Tone = Schema.Literals(["success", "running", "failure", "idle"]);
export type Tone = typeof Tone.Type;

const TONE: Record<Status, Tone> = {
  success: "success",
  failure: "failure",
  running: "running",
  queued: "idle",
  cancelled: "idle",
  skipped: "idle",
  idle: "idle",
};

export const toneOf = (status: Status): Tone => TONE[status];

/** Active = running or queued: the run can still change. */
export const isActive = (status: Status): boolean => status === "running" || status === "queued";

/** Lower = more urgent. */
const URGENCY: Record<Status, number> = {
  failure: 0,
  running: 1,
  queued: 2,
  cancelled: 3,
  success: 4,
  skipped: 5,
  idle: 6,
};

/** Most urgent first: failure, running, queued, cancelled, success, skipped, idle. */
export const byUrgency: Order.Order<Status> = Order.mapInput(
  Order.Number,
  (status: Status) => URGENCY[status],
);

/** Overall status from the statuses of the parts (jobs of a run, steps of a job). */
export const aggregate = (statuses: ReadonlyArray<Status>): Status => {
  if (statuses.length === 0) return "idle";
  for (const status of ["failure", "running", "queued"] as const)
    if (statuses.includes(status)) return status;
  if (statuses.every((status) => status === "skipped")) return "skipped";
  if (statuses.includes("cancelled")) return "cancelled";
  return "success";
};
