import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from './authService';
import magicLinkService from './magicLinkService';

/**
 * Sign-out is best effort: if a local removal fails, the app still shows
 * signed out, and this flag asks the next app start to finish the job.
 * It holds only a timestamp, so AsyncStorage (not SecureStore) is fine.
 */
const PENDING_LOCAL_CLEANUP_KEY = 'pending_local_cleanup';
const ACTIVATION_DATE_KEY = 'activation_date';

export async function markPendingLocalCleanup(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_LOCAL_CLEANUP_KEY, JSON.stringify({ at: new Date().toISOString() }));
  } catch (error) {
    console.warn('Could not store the pending local cleanup flag:', error);
  }
}

/**
 * Remove the tokens, cached user and activation record, each step independently.
 * Resolves true only when every step succeeded.
 */
export async function clearLocalSession(): Promise<boolean> {
  let complete = true;
  for (const step of [
    () => authService.logout({ strict: true }),
    () => magicLinkService.clearDeviceActivation({ strict: true }),
  ]) {
    try {
      await step();
    } catch (error) {
      console.warn('Local sign-out step failed:', error);
      complete = false;
    }
  }
  return complete;
}

/** True when the device signed in again (activation_date is rewritten at every sign-in) after the flag was set. */
async function signedInSince(flaggedAt: number): Promise<boolean> {
  const activatedAt = Date.parse((await AsyncStorage.getItem(ACTIVATION_DATE_KEY)) ?? '');
  return !Number.isNaN(activatedAt) && activatedAt > flaggedAt;
}

/**
 * App start: finish a sign-out that was left incomplete. A session created
 * after the failed sign-out must not be undone, so then only the flag goes.
 */
export async function finishPendingLocalCleanup(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_LOCAL_CLEANUP_KEY);
    if (!raw) return;
    let flaggedAt = NaN;
    try {
      flaggedAt = Date.parse(JSON.parse(raw)?.at);
    } catch {
      // unreadable flag: treat as older than any session
    }
    if (!Number.isNaN(flaggedAt) && (await signedInSince(flaggedAt))) {
      await AsyncStorage.removeItem(PENDING_LOCAL_CLEANUP_KEY);
      return;
    }
    if (await clearLocalSession()) {
      await AsyncStorage.removeItem(PENDING_LOCAL_CLEANUP_KEY);
    }
  } catch (error) {
    console.warn('Pending local cleanup failed:', error);
  }
}
