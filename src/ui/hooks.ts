import { useEffect, useState } from "react"

/** The current time, refreshed every `everyMs`, so ages and running durations stay live. */
export const useNow = (everyMs = 1000): Date => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs)

    return () => clearInterval(timer)
  }, [everyMs])

  return now
}
