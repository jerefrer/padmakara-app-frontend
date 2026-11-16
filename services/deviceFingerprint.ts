/**
 * deviceFingerprint.ts
 *
 * The device fingerprint identifies this installation to the API, and an
 * activated fingerprint can sign the device back in without email. It is
 * therefore a secret: 32 bytes from the platform CSPRNG (expo-crypto), encoded
 * as base64url without padding (exactly 43 characters), kept through
 * tokenStorage (SecureStore on native, the browser storage on web).
 *
 * There is no weaker fallback. If the CSPRNG or the storage is unavailable,
 * DeviceFingerprintUnavailableError is thrown and the sign-in fails.
 *
 * Older builds stored a guessable value (device info, a timestamp and a
 * non-cryptographic random number) in AsyncStorage under 'device_fingerprint'. That legacy value
 * is only read by the one-time migration and by sign-out; see
 * magicLinkService.migrateLegacyFingerprint.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytesAsync } from 'expo-crypto';
import { deleteDeviceFingerprint, getDeviceFingerprint, setDeviceFingerprint } from './tokenStorage';

export const LEGACY_FINGERPRINT_KEY = 'device_fingerprint';

const FINGERPRINT_BYTES = 32;
const FINGERPRINT_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** This device cannot generate or keep a fingerprint safely, so it cannot be signed in. */
export class DeviceFingerprintUnavailableError extends Error {
  constructor(message: string, readonly reason?: unknown) {
    super(message);
    this.name = 'DeviceFingerprintUnavailableError';
  }
}

/** base64url (RFC 4648 §5) without padding. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const bits = (a << 16) | (b << 8) | c;
    out += BASE64URL[(bits >> 18) & 63] + BASE64URL[(bits >> 12) & 63];
    if (i + 1 < bytes.length) out += BASE64URL[(bits >> 6) & 63];
    if (i + 2 < bytes.length) out += BASE64URL[bits & 63];
  }
  return out;
}

/** A fresh fingerprint from the CSPRNG. Not stored. */
export async function createFingerprint(): Promise<string> {
  let bytes: Uint8Array;
  try {
    bytes = await getRandomBytesAsync(FINGERPRINT_BYTES);
  } catch (error) {
    throw new DeviceFingerprintUnavailableError('Secure random generator unavailable', error);
  }
  const value = bytes?.length === FINGERPRINT_BYTES ? toBase64Url(bytes) : '';
  if (!FINGERPRINT_PATTERN.test(value)) {
    throw new DeviceFingerprintUnavailableError('Secure random generator returned an unexpected value');
  }
  return value;
}

/** The stored fingerprint, or null when none was created yet. Throws when storage cannot be read. */
export async function readStoredFingerprint(): Promise<string | null> {
  try {
    return await getDeviceFingerprint();
  } catch (error) {
    throw new DeviceFingerprintUnavailableError('Secure storage cannot be read', error);
  }
}

/** Keep a fingerprint. Throws when storage cannot be written. */
export async function storeFingerprint(value: string): Promise<void> {
  try {
    await setDeviceFingerprint(value);
  } catch (error) {
    throw new DeviceFingerprintUnavailableError('Secure storage cannot be written', error);
  }
}

// Concurrent callers (several requests at sign-in) share one creation.
let inFlight: Promise<string> | null = null;

/** The fingerprint this device signs in with, created and stored on first use. */
export function getOrCreateDeviceFingerprint(): Promise<string> {
  if (!inFlight) {
    inFlight = (async () => {
      const stored = await readStoredFingerprint();
      if (stored) return stored;
      const created = await createFingerprint();
      await storeFingerprint(created);
      return created;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** The pre-migration value, if this device still has one. */
export async function getLegacyFingerprint(): Promise<string | null> {
  return AsyncStorage.getItem(LEGACY_FINGERPRINT_KEY);
}

export async function deleteLegacyFingerprint(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_FINGERPRINT_KEY);
}

/**
 * Sign-out: delete the fingerprint (and any legacy value) so the next sign-in
 * starts with a fresh one. Both removals are attempted; the first failure is rethrown.
 */
export async function forgetDeviceFingerprint(): Promise<void> {
  const results = await Promise.allSettled([deleteDeviceFingerprint(), deleteLegacyFingerprint()]);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) throw failed.reason;
}
