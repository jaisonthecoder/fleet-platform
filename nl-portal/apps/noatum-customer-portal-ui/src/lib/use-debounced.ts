import { useEffect, useState } from 'react';

/**
 * The value, once it has stopped changing for `delay` milliseconds.
 *
 * Used to keep a query key still while somebody is typing: without it a number
 * field fires one request per keystroke, and the answers race each other back.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
