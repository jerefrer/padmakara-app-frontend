import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { membershipService, type PaymentMethodType } from '@/services/membershipService';

export type CheckoutPhase = 'checking' | 'active' | 'processing' | 'failed' | 'timeout' | 'missing';

interface Options {
  intervalMs?: number;
  timeoutMs?: number;
}

interface Result {
  phase: CheckoutPhase;
  method: PaymentMethodType | null;
}

/**
 * Polls the server until Easypay's confirmation has actually arrived.
 * A failed poll (non-success response or thrown error, e.g. a transient 500)
 * is never terminal: we keep polling until the overall timeout.
 */
export function useCheckoutStatus(checkoutId: string | undefined, opts: Options = {}): Result {
  const { intervalMs = 3000, timeoutMs = 180000 } = opts;
  const { refreshUserData } = useAuth();
  const refreshRef = useRef(refreshUserData);
  refreshRef.current = refreshUserData;

  const [result, setResult] = useState<Result>({
    phase: checkoutId ? 'checking' : 'missing',
    method: null,
  });

  useEffect(() => {
    if (!checkoutId) {
      setResult({ phase: 'missing', method: null });
      return;
    }
    setResult({ phase: 'checking', method: null });

    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (phase: CheckoutPhase, method: PaymentMethodType | null) => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      setResult({ phase, method });
    };

    const poll = async () => {
      try {
        const res = await membershipService.checkoutStatus(checkoutId);
        if (stopped) return;
        if (res.success && res.data) {
          const { state, method } = res.data;
          if (state === 'active') {
            finish('active', method);
            void refreshRef.current();
            return;
          }
          if (state === 'processing' || state === 'failed') {
            finish(state, method);
            return;
          }
        }
      } catch {
        // transient error: keep polling
      }
      if (!stopped) pollTimer = setTimeout(poll, intervalMs);
    };

    timeoutTimer = setTimeout(() => finish('timeout', null), timeoutMs);
    void poll();

    return () => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [checkoutId, intervalMs, timeoutMs]);

  return result;
}
