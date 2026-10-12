import { useEffect, useState } from 'react';

/**
 * The current time, re-read on an interval.
 *
 * A page whose selling point is freshness cannot render "38 min ago" once and
 * leave it there. Components that show an age take this as their clock, so the
 * age moves on its own rather than waiting for an unrelated re-render.
 *
 * One minute by default: the smallest unit any of these screens displays, so a
 * shorter interval would re-render for nothing.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
