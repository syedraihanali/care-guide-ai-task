import { useEffect, useState } from 'react'

/** The current time, refreshed every `intervalMs`, so relative times ("2 minutes ago") stay current. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
