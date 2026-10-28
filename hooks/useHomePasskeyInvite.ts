import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { armInvite } from '@/hooks/passkeyInviteState';
import { markHandled, PASSKEY_INVITE_PATH, shouldInvite } from '@/hooks/usePasskeyInvite';
import { tryListPasskeys } from '@/services/passkeyService';

// A calm moment on home: let the screen settle before anything covers it.
const HOME_DELAY_MS = 2500;

// Screens mounted outside the player provider (tests, early boot) count as "nothing playing".
function useMediaPlaying(): boolean {
  try {
    const audio = useAudioPlayerContext();
    return !!audio.isPlaying || !!audio.videoPlaying;
  } catch {
    return false;
  }
}

/**
 * Members who were already signed in see the invitation once on home: when the screen is in
 * front, nothing is playing, passkeys are supported, they have none yet and it was not shown
 * before. A failed lookup means no invitation.
 */
export function useHomePasskeyInvite() {
  const { isAuthenticated, isDeviceActivated, user } = useAuth();
  const userId = user?.id ? String(user.id) : '';
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const busy = useMediaPlaying();
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!focused || busy || !isAuthenticated || !isDeviceActivated || !userId) return;
    if (asked.current === userId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (!(await shouldInvite(userId, 'email'))) {
          asked.current = userId;
          return;
        }
        const existing = await tryListPasskeys();
        if (cancelled) return;
        if (!existing) return;
        if (existing.length > 0) {
          // Already has a key: never ask again, not on every focus and not after removing them all.
          asked.current = userId;
          await markHandled(userId);
          return;
        }
        asked.current = userId;
        await markHandled(userId);
        if (cancelled) return;
        armInvite();
        router.push({ pathname: PASSKEY_INVITE_PATH } as any);
      } catch {
        // Any failure means no invitation.
      }
    }, HOME_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [focused, busy, isAuthenticated, isDeviceActivated, userId]);
}
