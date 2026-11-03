import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';

// Android 13+ keeps every notification of an app blocked until the app
// declares and is granted POST_NOTIFICATIONS. expo-audio shows the lock-screen
// and notification-shade media player as a notification, so without this
// permission that player never appears.
const ASKED_KEY = 'notificationPermission.asked.v1';
const ANDROID_13 = 33;

/** Whether this device needs the runtime request at all: Android 13+ only. */
export function needsNotificationPermission(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_13;
}

export interface ExplainerInput {
  os: string;
  version: number | string;
  asked: boolean;
  granted: boolean;
}

/** Pure decision: show our explanation before the system prompt? */
export function shouldShowExplainer({ os, version, asked, granted }: ExplainerInput): boolean {
  return os === 'android' && Number(version) >= ANDROID_13 && !asked && !granted;
}

// The explainer component registers here; the player context only emits.
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToExplainer(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let inFlight: Promise<void> | null = null;

async function offer(): Promise<void> {
  try {
    if (listeners.size === 0) return; // nobody can show it: do not use up the one chance
    const asked = !!(await AsyncStorage.getItem(ASKED_KEY));
    if (asked) return;
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (!shouldShowExplainer({ os: Platform.OS, version: Platform.Version, asked, granted })) return;
    // Remember before showing: dismissing it, however it happens, must never bring it back.
    await AsyncStorage.setItem(ASKED_KEY, '1');
    listeners.forEach((l) => l());
  } catch (error) {
    // Never let a permission problem get in the way of playback.
    console.warn('Notification explainer failed:', error);
  }
}

/**
 * Called the first time audio plays: shows the explainer at most once, ever.
 * Fire and forget: never rejects, never blocks playback.
 * No-op on iOS and web, below Android 13, when granted, and after the first time.
 */
export function offerNotificationExplainer(): Promise<void> {
  if (!needsNotificationPermission()) return Promise.resolve();
  if (!inFlight) {
    inFlight = offer().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** The system prompt, after the user chose Continue. Never rejects. */
export async function requestNotificationPermission(): Promise<string> {
  try {
    return await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch (error) {
    console.warn('Notification permission request failed:', error);
    return 'denied';
  }
}

/**
 * Whether lock-screen controls can show. Below Android 13 notifications are on by default,
 * so that counts as on. Never rejects.
 */
export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!needsNotificationPermission()) return true;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    return false;
  }
}
