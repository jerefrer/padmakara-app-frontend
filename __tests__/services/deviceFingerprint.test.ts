import fs from 'fs';
import path from 'path';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  DeviceFingerprintUnavailableError,
  forgetDeviceFingerprint,
  getOrCreateDeviceFingerprint,
  toBase64Url,
} from '@/services/deviceFingerprint';

jest.mock('expo-crypto', () => ({ getRandomBytesAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const crypto = Crypto as jest.Mocked<typeof Crypto>;
const store = SecureStore as jest.Mocked<typeof SecureStore>;
const originalOS = Platform.OS;
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

// 32 bytes 0..31: their base64url (no padding) is known in advance.
const BYTES = Uint8Array.from({ length: 32 }, (_, i) => i);
const EXPECTED = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;

let secure: Map<string, string>;

beforeEach(async () => {
  await forgetDeviceFingerprint().catch(() => undefined);
  jest.clearAllMocks();
  setOS('ios');
  secure = new Map();
  store.getItemAsync.mockImplementation(async (key: string) => secure.get(key) ?? null);
  store.setItemAsync.mockImplementation(async (key: string, value: string) => {
    secure.set(key, value);
  });
  store.deleteItemAsync.mockImplementation(async (key: string) => {
    secure.delete(key);
  });
  crypto.getRandomBytesAsync.mockResolvedValue(BYTES);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => setOS(originalOS));

describe('toBase64Url', () => {
  it('should encode 32 bytes as 43 base64url characters without padding', () => {
    expect(toBase64Url(BYTES)).toBe(EXPECTED);
  });

  it('should use - and _ instead of + and /', () => {
    expect(toBase64Url(Uint8Array.from([0xfb, 0xff]))).toBe('-_8');
  });
});

describe('getOrCreateDeviceFingerprint', () => {
  it('should return 43 base64url characters built from 32 CSPRNG bytes', async () => {
    const fp = await getOrCreateDeviceFingerprint();

    expect(crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(fp).toMatch(BASE64URL_43);
    expect(fp).toBe(EXPECTED);
  });

  it('should store it in secure storage and not in AsyncStorage on native', async () => {
    const fp = await getOrCreateDeviceFingerprint();

    expect([...secure.values()]).toContain(fp);
    const keys = await AsyncStorage.getAllKeys();
    const values = await Promise.all(keys.map((k) => AsyncStorage.getItem(k)));
    expect(values).not.toContain(fp);
  });

  it('should return the same value across calls without drawing new bytes', async () => {
    const first = await getOrCreateDeviceFingerprint();
    const second = await getOrCreateDeviceFingerprint();

    expect(second).toBe(first);
    expect(crypto.getRandomBytesAsync).toHaveBeenCalledTimes(1);
  });

  it('should create only one value when called concurrently', async () => {
    const [a, b] = await Promise.all([getOrCreateDeviceFingerprint(), getOrCreateDeviceFingerprint()]);

    expect(a).toBe(b);
    expect(crypto.getRandomBytesAsync).toHaveBeenCalledTimes(1);
  });

  it('should ignore a legacy device_fingerprint left in AsyncStorage', async () => {
    await AsyncStorage.setItem('device_fingerprint', 'eyJwbGF0Zm9ybSI6ImlvcyJ9');

    const fp = await getOrCreateDeviceFingerprint();

    expect(fp).toBe(EXPECTED);
  });

  it('should fail instead of inventing a value when secure storage cannot be written', async () => {
    store.setItemAsync.mockRejectedValue(new Error('keychain unavailable'));

    await expect(getOrCreateDeviceFingerprint()).rejects.toBeInstanceOf(DeviceFingerprintUnavailableError);
  });

  it('should fail instead of inventing a value when secure storage cannot be read', async () => {
    store.getItemAsync.mockRejectedValue(new Error('keychain unavailable'));

    await expect(getOrCreateDeviceFingerprint()).rejects.toBeInstanceOf(DeviceFingerprintUnavailableError);
    expect(crypto.getRandomBytesAsync).not.toHaveBeenCalled();
  });

  it('should fail when the CSPRNG is unavailable', async () => {
    crypto.getRandomBytesAsync.mockRejectedValue(new Error('no native module'));

    await expect(getOrCreateDeviceFingerprint()).rejects.toBeInstanceOf(DeviceFingerprintUnavailableError);
    expect(secure.size).toBe(0);
  });

  it('should fail when the CSPRNG returns fewer bytes than asked', async () => {
    crypto.getRandomBytesAsync.mockResolvedValue(new Uint8Array(8));

    await expect(getOrCreateDeviceFingerprint()).rejects.toBeInstanceOf(DeviceFingerprintUnavailableError);
  });

  it('should never call Math.random', async () => {
    const random = jest.spyOn(Math, 'random');

    await getOrCreateDeviceFingerprint();

    expect(random).not.toHaveBeenCalled();
  });

  it('should use the browser storage path on web', async () => {
    setOS('web');

    const fp = await getOrCreateDeviceFingerprint();

    expect(store.setItemAsync).not.toHaveBeenCalled();
    const keys = await AsyncStorage.getAllKeys();
    const values = await Promise.all(keys.map((k) => AsyncStorage.getItem(k)));
    expect(values).toContain(fp);
    expect(await AsyncStorage.getItem('device_fingerprint')).toBeNull();
  });
});

describe('forgetDeviceFingerprint', () => {
  it('should delete the fingerprint so the next call creates a fresh one', async () => {
    const first = await getOrCreateDeviceFingerprint();
    crypto.getRandomBytesAsync.mockResolvedValue(Uint8Array.from({ length: 32 }, () => 7));

    await forgetDeviceFingerprint();
    const second = await getOrCreateDeviceFingerprint();

    expect(secure.size).toBe(1);
    expect(second).not.toBe(first);
  });

  it('should delete the legacy AsyncStorage value as well', async () => {
    await AsyncStorage.setItem('device_fingerprint', 'legacy');

    await forgetDeviceFingerprint();

    expect(await AsyncStorage.getItem('device_fingerprint')).toBeNull();
  });
});

describe('fingerprint source', () => {
  it('should contain no Math.random in the fingerprint path', () => {
    for (const file of ['services/deviceFingerprint.ts', 'services/magicLinkService.ts']) {
      const source = fs.readFileSync(path.join(__dirname, '../../', file), 'utf8');
      expect({ file, usesMathRandom: source.includes('Math.random') }).toEqual({ file, usesMathRandom: false });
    }
  });
});
