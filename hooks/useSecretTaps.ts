import { useCallback, useRef } from 'react';

/**
 * A hidden gesture: returns a tap handler that calls `onUnlock` after `count`
 * taps, each within `windowMs` of the previous one. A slower tap starts over.
 */
export function useSecretTaps(count: number, onUnlock: () => void, windowMs = 1500): () => void {
  const taps = useRef(0);
  const lastTap = useRef(0);

  return useCallback(() => {
    const now = Date.now();
    taps.current = now - lastTap.current <= windowMs ? taps.current + 1 : 1;
    lastTap.current = now;
    if (taps.current >= count) {
      taps.current = 0;
      onUnlock();
    }
  }, [count, onUnlock, windowMs]);
}
