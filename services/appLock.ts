/**
 * appLock.ts
 *
 * The optional app lock: a per-device setting (never sent to the server) that
 * asks for Face ID / Touch ID / fingerprint, or the device passcode, when the
 * app opens or comes back after a while away.
 *
 * The flag lives in the Keychain / Keystore via expo-secure-store. On web
 * there is no biometric prompt, so everything reports "unavailable".
 */

import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const APP_LOCK_KEY = 'app_lock_enabled';

/** How long the app may stay in the background before it asks again. */
export const APP_LOCK_GRACE_MS = 5 * 60 * 1000;

export type BiometricKind = 'faceId' | 'touchId' | 'fingerprint' | 'biometrics';

export interface AppLockAuthResult {
  success: boolean;
  /** expo-local-authentication error code, e.g. `user_cancel` or `not_enrolled`. */
  error?: string;
}

const isNative = () => Platform.OS === 'ios' || Platform.OS === 'android';

/** Errors meaning the device no longer has a biometric or a passcode to ask for. */
export function isNothingToAskFor(error: string | undefined): boolean {
  return error === 'not_enrolled' || error === 'passcode_not_set';
}

export async function getAppLockEnabled(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await SecureStore.getItemAsync(APP_LOCK_KEY)) === 'true';
  } catch (error) {
    console.error('[appLock] failed to read the flag:', error);
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    if (enabled) await SecureStore.setItemAsync(APP_LOCK_KEY, 'true');
    else await SecureStore.deleteItemAsync(APP_LOCK_KEY);
  } catch (error) {
    console.error('[appLock] failed to write the flag:', error);
    throw error;
  }
}

/** Which biometric this device offers, or null when none is set up (or on web). */
export async function biometricKind(): Promise<BiometricKind | null> {
  if (!isNative()) return null;
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !enrolled) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const { FACIAL_RECOGNITION, FINGERPRINT } = LocalAuthentication.AuthenticationType;
    if (Platform.OS === 'ios') {
      if (types.includes(FACIAL_RECOGNITION)) return 'faceId';
      if (types.includes(FINGERPRINT)) return 'touchId';
    } else if (types.includes(FINGERPRINT)) {
      return 'fingerprint';
    }
    return 'biometrics';
  } catch (error) {
    console.error('[appLock] failed to read the biometric kind:', error);
    return null;
  }
}

/** Prompts for the biometric, falling back to the device passcode. Both labels are already localized. */
export async function authenticate(labels: {
  promptMessage: string;
  cancelLabel?: string;
}): Promise<AppLockAuthResult> {
  if (!isNative()) return { success: false, error: 'not_available' };
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: labels.promptMessage,
      cancelLabel: labels.cancelLabel,
      disableDeviceFallback: false,
    });
    return result.success ? { success: true } : { success: false, error: result.error };
  } catch (error) {
    console.error('[appLock] authentication failed:', error);
    return { success: false, error: 'unknown' };
  }
}

/** Translation keys (with English fallbacks) for the labels that depend on the biometric. */
export function kindLabels(kind: BiometricKind | null): {
  titleKey: string;
  titleFallback: string;
  unlockKey: string;
  unlockFallback: string;
} {
  switch (kind) {
    case 'faceId':
      return { titleKey: 'appLock.titleFaceId', titleFallback: 'Lock with Face ID', unlockKey: 'appLock.unlockFaceId', unlockFallback: 'Unlock with Face ID' };
    case 'touchId':
      return { titleKey: 'appLock.titleTouchId', titleFallback: 'Lock with Touch ID', unlockKey: 'appLock.unlockTouchId', unlockFallback: 'Unlock with Touch ID' };
    case 'fingerprint':
      return { titleKey: 'appLock.titleFingerprint', titleFallback: 'Lock with fingerprint', unlockKey: 'appLock.unlockFingerprint', unlockFallback: 'Unlock with fingerprint' };
    case 'biometrics':
      return { titleKey: 'appLock.titleBiometrics', titleFallback: 'Lock with biometrics', unlockKey: 'appLock.unlockBiometrics', unlockFallback: 'Unlock with biometrics' };
    default:
      return { titleKey: 'appLock.titleBiometrics', titleFallback: 'Lock with biometrics', unlockKey: 'appLock.unlock', unlockFallback: 'Unlock' };
  }
}
