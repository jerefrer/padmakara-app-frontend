import React, { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { PasskeyInvite } from '@/components/auth/PasskeyInvite';

/**
 * The passkey invitation. `next` is where the person was going (full-page sign-in); without it
 * they go back to the screen the invitation opened over, or home.
 */
export default function PasskeyInviteScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : '';

  const onContinue = useCallback(() => {
    if (next) router.replace(next as any);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  }, [next]);

  if (!userId) return null;
  return <PasskeyInvite userId={userId} onContinue={onContinue} />;
}
