import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';

// Android 13+ keeps every notification of an app blocked until the app
// declares and is granted POST_NOTIFICATIONS. expo-audio shows the lock-screen
// and notification-shade media player as a notification, so without this
// permission that player never appears.
const ASKED_KEY = 'notificationPermission.asked.v1';
const ANDROID_13 = 33;

let inFlight: Promise<void> | null = null;

/** Whether this device needs the runtime request at all: Android 13+ only. */
export function needsNotificationPermission(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_13;
}

async function run(): Promise<void> {
  if (!needsNotificationPermission()) return;
  try {
    if (await AsyncStorage.getItem(ASKED_KEY)) return;
    // Remember before asking: a denial must never bring the prompt back.
    await AsyncStorage.setItem(ASKED_KEY, '1');
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (await PermissionsAndroid.check(permission)) return;
    await PermissionsAndroid.request(permission);
  } catch (error) {
    // Never let a permission problem get in the way of playback.
    console.warn('Notification permission request failed:', error);
  }
}

/**
 * Ask once for the notification permission, the first time audio plays.
 * Fire and forget: resolves when done, never rejects, never blocks playback.
 * No-op on iOS and web, below Android 13, and after the first ask.
 */
export function requestNotificationPermissionOnce(): Promise<void> {
  if (!needsNotificationPermission()) return Promise.resolve();
  if (!inFlight) {
    inFlight = run().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
