import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clearEmailSignInMarker } from '@/hooks/passkeyInviteState';
import { signInWithPasskey, supportsPasskeyAutofill } from '@/services/passkeyService';

const REARM_MS = 4 * 60 * 1000;
const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 1000;

/**
 * Web only (supportsPasskeyAutofill is false elsewhere): while the email form is on screen, offer
 * the browser's saved passkeys in the email field. The pending request holds a server challenge
 * and the browser allows one at a time, so `abort` must run when the form is submitted; it also
 * runs on unmount. Failures are silent. A request that ends on its own is restarted (at most
 * three times) and the pending request is renewed every four minutes while the form is active.
 */
export function usePasskeyAutofill(onSignedIn: () => void, enabled = true) {
  const { refreshAuth } = useAuth();
  const controller = useRef<AbortController | null>(null);
  const callback = useRef(onSignedIn);
  callback.current = onSignedIn;
  // AuthContext recreates refreshAuth on every render; keep it out of the effect deps so a
  // re-render never aborts and restarts the pending request.
  const refresh = useRef(refreshAuth);
  refresh.current = refreshAuth;

  const abort = useCallback(() => {
    const current = controller.current;
    controller.current = null;
    current?.abort();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let restarts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (stopped) return;
      const own = new AbortController();
      controller.current = own;
      // Our own periodic re-arm (the server challenge lives five minutes): abort, then start again.
      let rearm = false;
      const rearmTimer = setTimeout(() => {
        rearm = true;
        own.abort();
      }, REARM_MS);
      try {
        if (!(await supportsPasskeyAutofill()) || own.signal.aborted) return;
        const result = await signInWithPasskey({ autofill: true, signal: own.signal });
        if (own.signal.aborted) {
          // Submit and unmount abort for good; only our own timed abort starts over.
          if (rearm && !stopped) {
            timer = setTimeout(run, 0);
          }
          return;
        }
        if (!result.ok) {
          // Ended on its own (browser timeout, failure): offer saved passkeys again, a few times.
          if (restarts < MAX_RESTARTS && !stopped) {
            restarts += 1;
            timer = setTimeout(run, RESTART_DELAY_MS);
          }
          return;
        }
        clearEmailSignInMarker();
        await refresh.current();
        if (!own.signal.aborted) callback.current();
      } finally {
        clearTimeout(rearmTimer);
      }
    };
    run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      const current = controller.current;
      controller.current = null;
      current?.abort();
    };
  }, [enabled]);

  return { abort };
}
