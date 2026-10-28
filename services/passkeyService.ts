import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';
import magicLinkService from './magicLinkService';
import passkeyClient from './passkeyClient';
import type { PasskeyOptionsJSON, PasskeyCredentialJSON } from './passkeyClient.types';

export interface PasskeySummary {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** `cancelled` is true when the person dismissed the system sheet (or the request was aborted): not an error. */
export type PasskeyResult = { ok: true } | { ok: false; cancelled: boolean };

/** A single-use server challenge with the WebAuthn options built from it (valid for five minutes). */
export interface PasskeyChallenge {
  challengeId: string;
  options: PasskeyOptionsJSON;
}

type ChallengeResponse = PasskeyChallenge;

interface LoginVerifyResponse {
  status?: string;
  message?: string;
  access_token?: string;
  refresh_token?: string;
  user?: unknown;
}

const FAILED: PasskeyResult = { ok: false, cancelled: false };
const CANCELLED: PasskeyResult = { ok: false, cancelled: true };

export async function isPasskeySupported(): Promise<boolean> {
  try {
    return await passkeyClient.isSupported();
  } catch {
    return false;
  }
}

/** Web only (conditional UI); native always answers false. */
export async function supportsPasskeyAutofill(): Promise<boolean> {
  try {
    return await passkeyClient.supportsAutofill();
  } catch {
    return false;
  }
}

/**
 * Fetches registration options ahead of time. Safari only accepts `credentials.create()` inside the
 * user gesture, so the web caller fetches on mount and passes the result to `registerPasskey`.
 */
export async function fetchRegistrationChallenge(): Promise<PasskeyChallenge | null> {
  try {
    const response = await apiService.post<ChallengeResponse>(API_ENDPOINTS.PASSKEY_REGISTER_OPTIONS, {});
    return response.success && response.data ? response.data : null;
  } catch {
    return null;
  }
}

/** Like `fetchRegistrationChallenge`, for `signInWithPasskey` (`credentials.get()`). */
export async function fetchLoginChallenge(): Promise<PasskeyChallenge | null> {
  try {
    const response = await apiService.post<ChallengeResponse>(API_ENDPOINTS.PASSKEY_LOGIN_OPTIONS, {});
    return response.success && response.data ? response.data : null;
  } catch {
    return null;
  }
}

/**
 * Creates a passkey for the signed-in person on this device. With a prefetched `challenge` the
 * browser API is called before any `await`, so it still runs inside the click that triggered it.
 */
export async function registerPasskey(opts: { challenge?: PasskeyChallenge } = {}): Promise<PasskeyResult> {
  try {
    const challenge = opts.challenge ?? (await fetchRegistrationChallenge());
    if (!challenge) return FAILED;

    let credential: PasskeyCredentialJSON;
    try {
      credential = await passkeyClient.create(challenge.options);
    } catch (error) {
      if (passkeyClient.isCancelled(error)) return CANCELLED;
      console.error('Passkey creation failed:', error);
      return FAILED;
    }

    const verified = await apiService.post<{ passkey: PasskeySummary }>(API_ENDPOINTS.PASSKEY_REGISTER_VERIFY, {
      challengeId: challenge.challengeId,
      response: credential,
      name: passkeyClient.defaultName(),
    });
    return verified.success ? { ok: true } : FAILED;
  } catch (error) {
    console.error('Error registering passkey:', error);
    return FAILED;
  }
}

/**
 * Signs in with a passkey. On success the tokens are stored exactly as `verifyEmailCode` does;
 * the caller then refreshes its auth state.
 */
export async function signInWithPasskey(
  opts: { autofill?: boolean; signal?: AbortSignal; challenge?: PasskeyChallenge } = {},
): Promise<PasskeyResult> {
  try {
    // With a prefetched challenge nothing is awaited before passkeyClient.get (Safari user gesture).
    const challenge = opts.challenge ?? (await fetchLoginChallenge());
    if (!challenge) return FAILED;

    let credential: PasskeyCredentialJSON;
    try {
      credential = await passkeyClient.get(challenge.options, {
        autofill: opts.autofill,
        signal: opts.signal,
      });
    } catch (error) {
      if (passkeyClient.isCancelled(error)) return CANCELLED;
      console.error('Passkey assertion failed:', error);
      return FAILED;
    }

    const deviceInfo = await magicLinkService.getDeviceInfo();
    const verified = await apiService.post<LoginVerifyResponse>(API_ENDPOINTS.PASSKEY_LOGIN_VERIFY, {
      challengeId: challenge.challengeId,
      response: credential,
      device_fingerprint: deviceInfo.fingerprint,
      device_name: deviceInfo.name,
      device_type: deviceInfo.type,
    });
    if (!verified.success || !verified.data?.access_token) return FAILED;

    await magicLinkService.storeActivation(verified.data as Parameters<typeof magicLinkService.storeActivation>[0]);
    return { ok: true };
  } catch (error) {
    console.error('Error signing in with passkey:', error);
    return FAILED;
  }
}

/** Like `listPasskeys`, but `null` when the list could not be fetched (so "none yet" is not guessed). */
export async function tryListPasskeys(): Promise<PasskeySummary[] | null> {
  try {
    const response = await apiService.get<{ passkeys: PasskeySummary[] }>(API_ENDPOINTS.PASSKEYS);
    return response.success && response.data ? response.data.passkeys : null;
  } catch {
    return null;
  }
}

export async function listPasskeys(): Promise<PasskeySummary[]> {
  return (await tryListPasskeys()) ?? [];
}

export async function removePasskey(id: number): Promise<boolean> {
  const response = await apiService.delete<unknown>(API_ENDPOINTS.PASSKEY(id));
  return response.success;
}
