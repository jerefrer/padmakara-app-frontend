import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What the iPhone / iPad lock screen shows around play and pause (iOS has room for two buttons):
 *   - 'seconds': 15 seconds back / forward (the default)
 *   - 'tracks':  previous / next track
 * Android shows all four, so it ignores this.
 */
export type LockScreenButtons = 'seconds' | 'tracks';

export const DEFAULT_LOCK_SCREEN_BUTTONS: LockScreenButtons = 'seconds';
const KEY = 'lockScreen.buttons';

const listeners = new Set<(value: LockScreenButtons) => void>();

export function parseLockScreenButtons(raw: string | null): LockScreenButtons {
  return raw === 'tracks' || raw === 'seconds' ? raw : DEFAULT_LOCK_SCREEN_BUTTONS;
}

export async function getLockScreenButtons(): Promise<LockScreenButtons> {
  try {
    return parseLockScreenButtons(await AsyncStorage.getItem(KEY));
  } catch {
    return DEFAULT_LOCK_SCREEN_BUTTONS;
  }
}

/** Saves the choice and tells the subscribers at once, so a lock screen already up follows it. */
export async function setLockScreenButtons(value: LockScreenButtons): Promise<void> {
  listeners.forEach((listener) => listener(value));
  try {
    await AsyncStorage.setItem(KEY, value);
  } catch {
    // The choice still holds for this session.
  }
}

export function subscribeToLockScreenButtons(listener: (value: LockScreenButtons) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
