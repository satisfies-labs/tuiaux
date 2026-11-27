import { Effect } from "effect"

import type { CliRenderer } from "@opentui/core"

import type { Notification } from "../monitor"

const BEL = "\x07"

/** Text from CI APIs goes into escape sequences: drop every control character so it can't add its own. */
export const sanitize = (text: string): string =>
  text.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")

/** OSC 9: a desktop notification from the terminal (iTerm2, WezTerm, Windows Terminal, …). */
export const osc9 = ({ title, body }: Notification): string =>
  `\x1b]9;${sanitize(`${title}: ${body}`)}${BEL}`

/**
 * Tells the user through the terminal: OpenTUI's notification where the terminal supports it
 * (kitty, OSC 99), OSC 9 otherwise, then the bell. Waits for the renderer to be idle so the bytes
 * never land inside a frame.
 */
/** The part of the renderer an alert needs. */
export type AlertTarget = Pick<CliRenderer, "idle" | "triggerNotification">

export const alert = (
  renderer: AlertTarget,
  write: (bytes: string) => void,
  notification: Notification,
  bell: boolean,
): Effect.Effect<void> =>
  Effect.promise(() => renderer.idle()).pipe(
    Effect.andThen(
      Effect.sync(() => {
        const shown = renderer.triggerNotification(
          sanitize(notification.body),
          sanitize(notification.title),
        )

        const bytes = `${shown ? "" : osc9(notification)}${bell ? BEL : ""}`

        if (bytes !== "") write(bytes)
      }),
    ),
  )
