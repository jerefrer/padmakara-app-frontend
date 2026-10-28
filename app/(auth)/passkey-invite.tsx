import React, { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { disarmInvite, isInviteArmed } from '@/hooks/passkeyInviteState';
import { safeInternalPath } from '@/utils/safeInternalPath';
import { PasskeyInvite } from '@/components/auth/PasskeyInvite';

/**
 * The passkey invitation. `next` is where the person was going (full-page sign-in); without it
 * they go back to the screen the invitation opened over, or home. Opened any other way than by
 * our triggers (browser Back, reload, a typed address) or without a user, it goes home instead.
 */
export default function PasskeyInviteScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : '';
  // Read once, before the invitation itself touches anything; a re-render must not change it.
  const [armed] = useState(() => isInviteArmed());
  const allowed = armed && !!userId;

  useEffect(() => {
    if (!allowed) router.replace('/(tabs)' as any);
    return () => disarmInvite();
  }, [allowed]);

  const onContinue = useCallback(() => {
    if (next) router.replace(safeInternalPath(next) as any);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  }, [next]);

  if (!allowed) return null;
  return <PasskeyInvite userId={userId} onContinue={onContinue} />;
}
