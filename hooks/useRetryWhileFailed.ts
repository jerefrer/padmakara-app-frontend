import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Waits before each automatic retry; after the last one only the app coming back or the reader can retry. */
export const RETRY_DELAYS_MS = [5_000, 15_000, 30_000];

/**
 * Retries a failed load while `failed` is true: a few times on its own, then
 * whenever the app returns to the foreground. A load that fails on a phone with
 * no signal would otherwise leave the screen empty until the reader thinks to
 * pull it down.
 */
export function useRetryWhileFailed(failed: boolean, retry: () => void): void {
  const attempts = useRef(0);
  const retryRef = useRef(retry);
  useEffect(() => {
    retryRef.current = retry;
  });

  useEffect(() => {
    if (!failed || attempts.current >= RETRY_DELAYS_MS.length) return;
    const timer = setTimeout(() => {
      attempts.current += 1;
      retryRef.current();
    }, RETRY_DELAYS_MS[attempts.current]);
    return () => clearTimeout(timer);
  }, [failed]);

  useEffect(() => {
    if (!failed) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryRef.current();
    });
    return () => sub.remove();
  }, [failed]);
}
