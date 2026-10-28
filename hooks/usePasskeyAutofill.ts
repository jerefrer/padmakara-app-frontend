import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithPasskey, supportsPasskeyAutofill } from '@/services/passkeyService';

/**
 * Web only (supportsPasskeyAutofill is false elsewhere): while the email form is on screen, offer
 * the browser's saved passkeys in the email field. The pending request holds a server challenge
 * and the browser allows one at a time, so `abort` must run when the form is submitted; it also
 * runs on unmount. Failures are silent and are not retried.
 */
export function usePasskeyAutofill(onSignedIn: () => void, enabled = true) {
  const { refreshAuth } = useAuth();
  const controller = useRef<AbortController | null>(null);
  const callback = useRef(onSignedIn);
  callback.current = onSignedIn;

  const abort = useCallback(() => {
    const current = controller.current;
    controller.current = null;
    current?.abort();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const own = new AbortController();
    controller.current = own;
    (async () => {
      if (!(await supportsPasskeyAutofill()) || own.signal.aborted) return;
      const result = await signInWithPasskey({ autofill: true, signal: own.signal });
      if (own.signal.aborted || !result.ok) return;
      await refreshAuth();
      if (!own.signal.aborted) callback.current();
    })();
    return () => {
      if (controller.current === own) controller.current = null;
      own.abort();
    };
  }, [enabled, refreshAuth]);

  return { abort };
}
