import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { isPasskeySupported } from '@/services/passkeyService';

export const PASSKEY_INVITE_PATH = '/(auth)/passkey-invite';

/** How the person just signed in. Only an email sign-in (link or code) is followed by the invitation. */
export type SignInMethod = 'email' | 'passkey';

export const PASSKEY_FLAG_PREFIX = 'passkeyInvite:';
const flagKey = (userId: string) => `${PASSKEY_FLAG_PREFIX}${userId}`;

async function wasShown(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(flagKey(userId))) !== null;
  } catch {
    // Storage unavailable: an invitation is better than none, and the flag is only a courtesy.
    return false;
  }
}

/** Remembers, per user and per device, that the invitation was shown (accepted, "Not now" or cancelled). */
export async function markHandled(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(flagKey(userId), String(Date.now()));
  } catch {
    // Not remembered; at worst the invitation comes back once.
  }
}

/** Passkeys supported here, shown to nobody twice on this device, and never after a passkey sign-in. */
export async function shouldInvite(userId: string, method: SignInMethod = 'email'): Promise<boolean> {
  if (!userId || method !== 'email') return false;
  if (!(await isPasskeySupported())) return false;
  return !(await wasShown(userId));
}

/**
 * Shows the invitation after an email sign-in when it is due. With `next` the invitation replaces
 * the current page and continues there; without it the invitation opens over the current screen.
 */
export async function inviteAfterEmailSignIn(userId: string, next?: string): Promise<boolean> {
  if (!(await shouldInvite(userId, 'email'))) return false;
  await markHandled(userId);
  if (next) router.replace({ pathname: PASSKEY_INVITE_PATH, params: { next } } as any);
  else router.push({ pathname: PASSKEY_INVITE_PATH } as any);
  return true;
}

/**
 * Email sign-in finished (`signedIn` flips to true) and the user is known: invite once.
 * Never call it for a passkey sign-in.
 */
export function useInviteAfterEmailSignIn(signedIn: boolean) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : '';
  const done = useRef(false);
  useEffect(() => {
    if (!signedIn || !userId || done.current) return;
    done.current = true;
    inviteAfterEmailSignIn(userId).catch(() => {});
  }, [signedIn, userId]);
}
