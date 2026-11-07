import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { armInvite } from '@/hooks/passkeyInviteState';
import { isPasskeySupported } from '@/services/passkeyService';

export const PASSKEY_INVITE_PATH = '/(auth)/passkey-invite';

/** How the person just signed in. Only an email sign-in (link or code) is followed by the invitation. */
export type SignInMethod = 'email' | 'passkey';

export const PASSKEY_FLAG_PREFIX = 'passkeyInvite:';
const flagKey = (userId: string) => `${PASSKEY_FLAG_PREFIX}${userId}`;

// After an email sign-in the invitation comes back until the person saves a key on this device,
// and stops after it was declined this many times (then Settings is the way).
export const MAX_EMAIL_INVITES = 2;
const CREATED = 'created';
// Older versions stored the time the invitation was shown; such a value counts as one showing.
const LEGACY_TIMESTAMP = 1_000_000_000;

interface InviteRecord {
  created: boolean;
  shown: number;
}

async function readRecord(userId: string): Promise<InviteRecord> {
  try {
    const raw = await AsyncStorage.getItem(flagKey(userId));
    if (raw === null) return { created: false, shown: 0 };
    if (raw === CREATED) return { created: true, shown: 0 };
    const n = Number(raw);
    if (!Number.isFinite(n) || n >= LEGACY_TIMESTAMP) return { created: false, shown: 1 };
    return { created: false, shown: Math.max(0, Math.floor(n)) };
  } catch {
    // Storage unavailable: an invitation is better than none, and the flag is only a courtesy.
    return { created: false, shown: 0 };
  }
}

/** Counts, per user and per device, one more showing of the invitation. */
export async function markInviteShown(userId: string): Promise<void> {
  const record = await readRecord(userId);
  if (record.created) return;
  try {
    await AsyncStorage.setItem(flagKey(userId), String(record.shown + 1));
  } catch {
    // Not remembered; at worst the invitation comes back once more.
  }
}

/** A key was saved on this device: the invitation never comes back here for this user. */
export async function markPasskeyCreated(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(flagKey(userId), CREATED);
  } catch {
    // Not remembered; the next email sign-in may invite once more.
  }
}

/**
 * After an email sign-in, on a device that supports passkeys: until a key was saved here, and at
 * most MAX_EMAIL_INVITES times. Never after a passkey sign-in.
 */
export async function shouldInvite(userId: string, method: SignInMethod = 'email'): Promise<boolean> {
  if (!userId || method !== 'email') return false;
  if (!(await isPasskeySupported())) return false;
  const record = await readRecord(userId);
  return !record.created && record.shown < MAX_EMAIL_INVITES;
}

/** On home, for members who were already signed in: only if the invitation was never shown here. */
export async function shouldInviteOnHome(userId: string): Promise<boolean> {
  if (!userId || !(await isPasskeySupported())) return false;
  const record = await readRecord(userId);
  return !record.created && record.shown === 0;
}

/**
 * Shows the invitation after an email sign-in when it is due. With `next` the invitation replaces
 * the current page and continues there; without it the invitation opens over the current screen.
 */
export async function inviteAfterEmailSignIn(userId: string, next?: string): Promise<boolean> {
  if (!(await shouldInvite(userId, 'email'))) return false;
  await markInviteShown(userId);
  armInvite();
  if (next) router.replace({ pathname: PASSKEY_INVITE_PATH, params: { next } } as any);
  else router.push({ pathname: PASSKEY_INVITE_PATH } as any);
  return true;
}
