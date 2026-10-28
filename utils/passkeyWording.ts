/**
 * Which words describe passkeys on this device. Wording only, never a capability check:
 * chosen from the platform and, on the web, the browser (every browser on iOS/iPadOS and
 * Safari on a Mac store passkeys in iCloud Keychain; Chrome syncs them with the Google account).
 */
export type PasskeyDevice = 'ios' | 'android' | 'mac' | 'desktop' | 'other';
/** Which biometric phrase: Face ID / Touch ID, Touch ID alone, a phone's fingerprint or face, or the generic "fingerprint, face or PIN". */
export type PasskeyMethod = 'ios' | 'mac' | 'android' | 'desktop' | 'generic';
export type PasskeySync = 'apple' | 'google' | 'other';

export interface PasskeyWording {
  device: PasskeyDevice;
  method: PasskeyMethod;
  sync: PasskeySync;
  /** True when the Apple wording (Face ID / Touch ID, iCloud) applies. */
  apple: boolean;
  /** An iPad (so the copy says "device" rather than "phone"). */
  tablet: boolean;
}

export interface PasskeyWordingInput {
  /** `Platform.OS` */
  os: string;
  /** `navigator.userAgent`, used when `os` is `web`. */
  userAgent?: string;
  /** `Platform.isPad` on native iOS. */
  isPad?: boolean;
  /** `navigator.maxTouchPoints`: iPadOS Safari sends a Mac user agent but has a touch screen. */
  maxTouchPoints?: number;
}

const IOS = { device: 'ios', method: 'ios', sync: 'apple', apple: true } as const;

export function getPasskeyWording({ os, userAgent = '', maxTouchPoints = 0, isPad = false }: PasskeyWordingInput): PasskeyWording {
  if (os === 'ios') return { ...IOS, tablet: isPad };
  if (os === 'android') return { device: 'android', method: 'android', sync: 'google', apple: false, tablet: false };
  if (os !== 'web') return { device: 'other', method: 'generic', sync: 'other', apple: false, tablet: false };

  const ua = userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return { ...IOS, tablet: /iPad/i.test(ua) };
  if (/Macintosh|Mac OS X/i.test(ua)) {
    if (maxTouchPoints > 1) return { ...IOS, tablet: true };
    // Only Safari uses iCloud Keychain on a Mac; other browsers have their own store.
    const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS\/|Edg\/|OPR\/|Firefox\/|FxiOS\//.test(ua);
    return safari
      ? { device: 'mac', method: 'mac', sync: 'apple', apple: true, tablet: false }
      : { device: 'mac', method: 'desktop', sync: syncFor(ua), apple: false, tablet: false };
  }
  const device: PasskeyDevice = /Android/i.test(ua) ? 'android' : /Windows|Linux|CrOS/i.test(ua) ? 'desktop' : 'other';
  return { device, method: device === 'other' ? 'generic' : 'desktop', sync: syncFor(ua), apple: false, tablet: false };
}

function isChrome(ua: string): boolean {
  return /Chrome\/|CriOS\//.test(ua) && !/Edg\/|EdgA\/|OPR\/|SamsungBrowser\//.test(ua);
}

function syncFor(ua: string): PasskeySync {
  return isChrome(ua) ? 'google' : 'other';
}

/** Reads the current environment; the only impure part. */
export function currentPasskeyWording(os: string, isPad = false): PasskeyWording {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  return getPasskeyWording({ os, isPad, userAgent: nav?.userAgent ?? '', maxTouchPoints: nav?.maxTouchPoints ?? 0 });
}
