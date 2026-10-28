import { useCallback, useEffect, useRef } from 'react';
import type { PasskeyChallenge } from '@/services/passkeyService';

// The server keeps a challenge for five minutes; renew a little before that.
const REFRESH_MS = 4 * 60 * 1000;

/**
 * Web only: keeps one fresh single-use passkey challenge on hand so a click handler can start the
 * browser ceremony synchronously. Safari (WebKit) rejects `credentials.get/create` when a network
 * wait sits between the tap and the call. `take()` hands the challenge out once (null when none is
 * ready or it is older than four minutes, in which case the caller fetches as before); `reload()`
 * fetches the next one and must run after every attempt, because a challenge is never reusable.
 */
export function usePasskeyChallenge(fetchChallenge: () => Promise<PasskeyChallenge | null>, enabled: boolean) {
  const slot = useRef<{ challenge: PasskeyChallenge; at: number } | null>(null);
  const generation = useRef(0);
  const fetcher = useRef(fetchChallenge);
  fetcher.current = fetchChallenge;
  const active = useRef(enabled);
  active.current = enabled;

  const reload = useCallback(async () => {
    if (!active.current) return;
    const mine = ++generation.current;
    slot.current = null;
    let challenge: PasskeyChallenge | null = null;
    try {
      challenge = await fetcher.current();
    } catch {
      challenge = null;
    }
    // A newer reload (or an unmount) supersedes this one.
    if (mine === generation.current && challenge) slot.current = { challenge, at: Date.now() };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
    const timer = setInterval(reload, REFRESH_MS);
    return () => {
      clearInterval(timer);
      generation.current += 1;
      slot.current = null;
    };
  }, [enabled, reload]);

  const take = useCallback((): PasskeyChallenge | undefined => {
    const current = slot.current;
    slot.current = null;
    if (!current || Date.now() - current.at >= REFRESH_MS) return undefined;
    return current.challenge;
  }, []);

  return { take, reload };
}
