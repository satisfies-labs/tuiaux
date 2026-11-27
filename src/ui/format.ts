import { Duration, Option } from "effect"

const pad = (n: number) => String(n).padStart(2, "0")

/** `0:42`, `12:07`, `1:02:33`; `—` when there is nothing to measure. */
export const formatDuration = (
  duration: Option.Option<Duration.Duration>,
): string =>
  Option.match(duration, {
    onNone: () => "—",
    onSome: value => {
      const total = Math.floor(Duration.toSeconds(value))
      const hours = Math.floor(total / 3600)
      const minutes = Math.floor((total % 3600) / 60)
      const clock = `${pad(minutes)}:${pad(total % 60)}`

      return hours > 0 ? `${hours}:${clock}` : clock.replace(/^0/, "")
    },
  })

/** `now`, `42s`, `12m`, `3h`, `2d`, `5w`; `—` without a date. */
export const formatAge = (date: Date | undefined, now: Date): string => {
  if (date === undefined) return "—"

  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 1000),
  )

  if (seconds < 10) return "now"

  if (seconds < 60) return `${seconds}s`

  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`

  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`

  if (seconds < 86_400 * 14) return `${Math.floor(seconds / 86_400)}d`

  return `${Math.floor(seconds / (86_400 * 7))}w`
}
