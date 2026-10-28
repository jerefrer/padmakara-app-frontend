import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import type { PasskeyClient } from './passkeyClient.types';

function browserName(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
}

function systemName(ua: string): string | null {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'Mac';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}

const passkeyClient: PasskeyClient = {
  async isSupported() {
    return browserSupportsWebAuthn();
  },

  async supportsAutofill() {
    return browserSupportsWebAuthnAutofill();
  },

  async create(options) {
    const response = await startRegistration({
      optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
    });
    return response as unknown as Record<string, unknown>;
  },

  async get(options, opts = {}) {
    const { autofill = false, signal } = opts;
    // @simplewebauthn/browser v14 has no `signal` option: it owns a single AbortController and
    // aborts the previous ceremony whenever a new one starts. A caller's signal is bridged to
    // its cancelCeremony() so a pending autofill request can be dropped on demand.
    if (signal?.aborted) {
      const aborted = new Error('Passkey request aborted');
      aborted.name = 'AbortError';
      throw aborted;
    }
    const onAbort = () => WebAuthnAbortService.cancelCeremony();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
        useBrowserAutofill: autofill,
      });
      return response as unknown as Record<string, unknown>;
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  },

  isCancelled(error) {
    const name = error && typeof error === 'object' ? (error as { name?: unknown }).name : undefined;
    return name === 'NotAllowedError' || name === 'AbortError';
  },

  defaultName() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const system = systemName(ua);
    if (system === 'iPhone' || system === 'iPad' || system === 'Android') return system;
    const browser = browserName(ua);
    return system ? `${browser} on ${system}` : browser;
  },
};

export default passkeyClient;
