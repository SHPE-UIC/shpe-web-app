import { useEffect, useReducer } from 'react';

/** The longest delay setTimeout honours; anything longer fires at once. */
const MAX_DELAY = 2 ** 31 - 1;

/**
 * Whether `at` has passed, re-rendering the moment it does, so a screen left
 * open across an event's start or end changes with it rather than on the next
 * refresh. `null` is never passed.
 */
export function useHasPassed(at: Date | null): boolean {
  const time = at ? at.getTime() : NaN;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const remaining = time - Date.now();
    // Already past, unknown, or further off than a timer can wait: nothing to
    // schedule. A screen open for 24 days re-checks on its next render.
    if (!(remaining > 0) || remaining > MAX_DELAY) return;
    const timer = setTimeout(rerender, remaining);
    return () => clearTimeout(timer);
  }, [time]);

  return Date.now() >= time;
}
