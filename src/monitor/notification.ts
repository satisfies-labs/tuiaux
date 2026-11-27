import { Option } from "effect"

import type { NotifyOn } from "../platform"
import type { RunSettled } from "./state"

export interface Notification {
  readonly title: string
  readonly body: string
}

/** What a settled run is worth telling, if anything: a failure, a fix, or (opt-in) any success. */
const kindOf = (settled: RunSettled): Option.Option<NotifyOn> => {
  const { run, previous } = settled

  if (run.status === "failure") return Option.some("failure")

  if (run.status !== "success") return Option.none()

  return previous?.status === "failure"
    ? Option.some("recovered")
    : Option.some("success")
}

const VERB: Record<NotifyOn, string> = {
  failure: "failed",
  success: "passed",
  recovered: "is green again",
}

/**
 * The notification for a settled run, when the config asks for its kind. A recovery also counts as
 * a success, so `on = ["success"]` alone hears about every green run.
 */
export const notificationFor = (
  settled: RunSettled,
  on: ReadonlyArray<NotifyOn>,
): Option.Option<Notification> =>
  kindOf(settled).pipe(
    Option.filter(
      kind =>
        on.includes(kind) || (kind === "recovered" && on.includes("success")),
    ),
    Option.map(kind => {
      const { run } = settled

      return {
        title: run.ref.repo.path,
        body: `${run.workflow} #${run.number} ${VERB[kind]} on ${run.branch}`,
      }
    }),
  )
