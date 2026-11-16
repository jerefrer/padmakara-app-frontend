/**
 * tokenStorage.ts
 *
 * Abstraction for storing bearer credentials (auth_token, refresh_token).
 *
 * On native (iOS / Android):
 *   - Values are stored in the Keychain / Keystore via expo-secure-store.
 *   - Transparent one-time migration: on the first read, if nothing is found
 *     in SecureStore we fall back to AsyncStorage, copy the value across into
 *     SecureStore, remove it from AsyncStorage, and return it — so users who
 *     were already logged in are NOT signed out after updating the app.
 *
 * On web:
 *   - expo-secure-store is unavailable; we keep using AsyncStorage
 *     (= localStorage under the hood), unchanged from before.
 *
 * The device fingerprint (see deviceFingerprint.ts) is a bearer secret too and
 * lives here under its own key, with strict helpers: unlike the tokens, a
 * storage failure is reported to the caller instead of being read as "absent".
 *
 * All other keys (user_data, device_activated, cache data, …) are NOT touched
 * by this module and remain in AsyncStorage as before.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Load SecureStore lazily; it is only referenced on native paths guarded by
// Platform.OS checks. A plain require instead of `await import()` keeps the
// call compilable to CommonJS under Jest, which has no dynamic-import support.
let SecureStore: typeof import('expo-secure-store') | null = null;

async function getSecureStore(): Promise<typeof import('expo-secure-store')> {
  if (SecureStore === null) {
    SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  }
  return SecureStore;
}

// Keys we manage in this module.
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// ─── Internal helpers ────────────────────────────────────────────────────────

async function nativeGet(key: string): Promise<string | null> {
  const ss = await getSecureStore();
  try {
    const value = await ss.getItemAsync(key);
    if (value !== null) {
      return value;
    }

    // Transparent migration: check legacy AsyncStorage location.
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      // Move into SecureStore and wipe the AsyncStorage copy.
      await ss.setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key);
      console.log(`[tokenStorage] Migrated '${key}' from AsyncStorage → SecureStore`);
    }
    return legacy;
  } catch (error) {
    console.error(`[tokenStorage] nativeGet('${key}') error:`, error);
    return null;
  }
}

async function nativeSet(key: string, value: string): Promise<void> {
  const ss = await getSecureStore();
  try {
    await ss.setItemAsync(key, value);
    // Also remove any stale AsyncStorage copy that might linger from before migration.
    await AsyncStorage.removeItem(key).catch(() => undefined);
  } catch (error) {
    console.error(`[tokenStorage] nativeSet('${key}') error:`, error);
    throw error;
  }
}

async function nativeDelete(key: string): Promise<void> {
  const ss = await getSecureStore();
  try {
    await ss.deleteItemAsync(key);
    // Belt-and-suspenders: also remove from AsyncStorage in case migration
    // hasn't run yet for this key.
    await AsyncStorage.removeItem(key).catch(() => undefined);
  } catch (error) {
    console.error(`[tokenStorage] nativeDelete('${key}') error:`, error);
  }
}

async function webGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`[tokenStorage] webGet('${key}') error:`, error);
    return null;
  }
}

async function webSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error(`[tokenStorage] webSet('${key}') error:`, error);
    throw error;
  }
}

async function webDelete(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`[tokenStorage] webDelete('${key}') error:`, error);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getAuthToken(): Promise<string | null> {
  return Platform.OS === 'web'
    ? webGet(AUTH_TOKEN_KEY)
    : nativeGet(AUTH_TOKEN_KEY);
}

export async function setAuthToken(value: string): Promise<void> {
  return Platform.OS === 'web'
    ? webSet(AUTH_TOKEN_KEY, value)
    : nativeSet(AUTH_TOKEN_KEY, value);
}

export async function deleteAuthToken(): Promise<void> {
  return Platform.OS === 'web'
    ? webDelete(AUTH_TOKEN_KEY)
    : nativeDelete(AUTH_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return Platform.OS === 'web'
    ? webGet(REFRESH_TOKEN_KEY)
    : nativeGet(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(value: string): Promise<void> {
  return Platform.OS === 'web'
    ? webSet(REFRESH_TOKEN_KEY, value)
    : nativeSet(REFRESH_TOKEN_KEY, value);
}

export async function deleteRefreshToken(): Promise<void> {
  return Platform.OS === 'web'
    ? webDelete(REFRESH_TOKEN_KEY)
    : nativeDelete(REFRESH_TOKEN_KEY);
}

/**
 * Delete both tokens atomically (best-effort).
 * Used by logout and auth-failure handlers.
 */
export async function deleteAllTokens(): Promise<void> {
  await Promise.all([deleteAuthToken(), deleteRefreshToken()]);
}

// ─── Pending device deactivation ─────────────────────────────────────────────
// A signed-out device whose server-side deactivation could not be delivered
// keeps the credentials needed to retry it. They are bearer secrets, so they
// go through the same SecureStore / AsyncStorage split as the tokens.

const PENDING_DEACTIVATION_KEY = 'pending_device_deactivation';

export async function getPendingDeactivationRaw(): Promise<string | null> {
  return Platform.OS === 'web'
    ? webGet(PENDING_DEACTIVATION_KEY)
    : nativeGet(PENDING_DEACTIVATION_KEY);
}

export async function setPendingDeactivationRaw(value: string): Promise<void> {
  return Platform.OS === 'web'
    ? webSet(PENDING_DEACTIVATION_KEY, value)
    : nativeSet(PENDING_DEACTIVATION_KEY, value);
}

export async function deletePendingDeactivation(): Promise<void> {
  return Platform.OS === 'web'
    ? webDelete(PENDING_DEACTIVATION_KEY)
    : nativeDelete(PENDING_DEACTIVATION_KEY);
}

// ─── Device fingerprint ──────────────────────────────────────────────────────
// A new key, deliberately not 'device_fingerprint': nativeGet() would otherwise
// copy the weak legacy value from AsyncStorage into SecureStore as if it were
// the new one. The legacy key is migrated separately (magicLinkService).
// These helpers throw on any storage failure: a fingerprint that cannot be
// read or kept must fail the sign-in, never be silently replaced.

const DEVICE_FINGERPRINT_KEY = 'device_fingerprint_v2';

export async function getDeviceFingerprint(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(DEVICE_FINGERPRINT_KEY);
  }
  const ss = await getSecureStore();
  return ss.getItemAsync(DEVICE_FINGERPRINT_KEY);
}

export async function setDeviceFingerprint(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(DEVICE_FINGERPRINT_KEY, value);
    return;
  }
  const ss = await getSecureStore();
  await ss.setItemAsync(DEVICE_FINGERPRINT_KEY, value);
}

export async function deleteDeviceFingerprint(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(DEVICE_FINGERPRINT_KEY);
    return;
  }
  const ss = await getSecureStore();
  await ss.deleteItemAsync(DEVICE_FINGERPRINT_KEY);
}
