import { useEffect, useState } from 'react'

/** Current time, refreshed every `everyMs` (30 s for button states, 1 s for ticking clocks). */
export function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}
