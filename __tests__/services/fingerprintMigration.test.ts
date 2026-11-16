import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import apiService from '@/services/apiService';

jest.mock('expo-crypto', () => ({ getRandomBytesAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('@/services/apiService', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('expo-device', () => ({ deviceName: null, modelName: null, osName: 'macOS' }));

const crypto = Crypto as jest.Mocked<typeof Crypto>;
const store = SecureStore as jest.Mocked<typeof SecureStore>;
const post = (apiService as unknown as { post: jest.Mock }).post;
const originalOS = Platform.OS;
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

const LEGACY_KEY = 'device_fingerprint';
const LEGACY = 'eyJwbGF0Zm9ybSI6ImlvcyIsInJhbmRvbSI6ImFiYyJ9';
const NEW_FP = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';

let secure: Map<string, string>;
// The service keeps "already tried this launch" in memory: load a fresh copy per test (= per launch).
let magicLinkService: typeof import('@/services/magicLinkService').default;
let fingerprint: typeof import('@/services/deviceFingerprint');

function launch() {
  jest.isolateModules(() => {
    magicLinkService = require('@/services/magicLinkService').default;
    fingerprint = require('@/services/deviceFingerprint');
  });
}

async function signIn() {
  secure.set('auth_token', 'acc');
  secure.set('refresh_token', 'ref');
  await AsyncStorage.setItem('device_activated', 'true');
}

const storedNew = () => [...secure.entries()].find(([k]) => k !== 'auth_token' && k !== 'refresh_token')?.[1];

beforeEach(() => {
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
  crypto.getRandomBytesAsync.mockResolvedValue(Uint8Array.from({ length: 32 }, (_, i) => i));
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  launch();
});

afterEach(() => setOS(originalOS));

describe('migrateLegacyFingerprint', () => {
  it('should rotate to a new fingerprint, store it and delete the legacy key when the server answers 200', async () => {
    await signIn();
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);
    post.mockResolvedValue({ success: true, status: 200, data: { status: 'rotated' } });

    await magicLinkService.migrateLegacyFingerprint();

    expect(post).toHaveBeenCalledWith('/auth/device/rotate', { old_fingerprint: LEGACY, new_fingerprint: NEW_FP });
    expect(storedNew()).toBe(NEW_FP);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('should keep the new fingerprint and delete the legacy key when the activation is gone (404)', async () => {
    await signIn();
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);
    post.mockResolvedValue({ success: false, status: 404, error: 'Not found' });

    await magicLinkService.migrateLegacyFingerprint();

    expect(storedNew()).toBe(NEW_FP);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('should keep the legacy value and store nothing on a network error, then retry at the next launch', async () => {
    await signIn();
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);
    post.mockResolvedValueOnce({ success: false, error: 'Network error' });

    await magicLinkService.migrateLegacyFingerprint();

    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBe(LEGACY);
    expect(storedNew()).toBeUndefined();
    expect(secure.get('auth_token')).toBe('acc');

    launch();
    post.mockResolvedValueOnce({ success: true, status: 200, data: { status: 'rotated' } });
    await magicLinkService.migrateLegacyFingerprint();

    expect(post).toHaveBeenCalledTimes(2);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(storedNew()).toBe(NEW_FP);
  });

  it('should keep the legacy value on a server error', async () => {
    await signIn();
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);
    post.mockResolvedValue({ success: false, status: 503, error: 'HTTP 503' });

    await magicLinkService.migrateLegacyFingerprint();

    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBe(LEGACY);
    expect(storedNew()).toBeUndefined();
  });

  it('should try only once per launch', async () => {
    await signIn();
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);
    post.mockResolvedValue({ success: false, error: 'Network error' });

    await magicLinkService.migrateLegacyFingerprint();
    await magicLinkService.migrateLegacyFingerprint();

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('should only delete the legacy key when signed out', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);

    await magicLinkService.migrateLegacyFingerprint();

    expect(post).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(storedNew()).toBeUndefined();
  });

  it('should do nothing when there is no legacy key', async () => {
    await signIn();

    await magicLinkService.migrateLegacyFingerprint();

    expect(post).not.toHaveBeenCalled();
    expect(crypto.getRandomBytesAsync).not.toHaveBeenCalled();
  });

  it('should reuse a new fingerprint already stored when a previous run stopped before deleting the legacy key', async () => {
    await signIn();
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);
    const existing = await fingerprint.getOrCreateDeviceFingerprint();
    crypto.getRandomBytesAsync.mockClear();
    post.mockResolvedValue({ success: false, status: 404, error: 'Not found' });

    await magicLinkService.migrateLegacyFingerprint();

    expect(post).toHaveBeenCalledWith('/auth/device/rotate', { old_fingerprint: LEGACY, new_fingerprint: existing });
    expect(crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(storedNew()).toBe(existing);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('should never throw, even when storage fails', async () => {
    await signIn();
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);
    store.getItemAsync.mockRejectedValue(new Error('keychain locked'));

    await expect(magicLinkService.migrateLegacyFingerprint()).resolves.not.toThrow();
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBe(LEGACY);
  });
});

describe('captureDeviceDeactivation while the migration is pending', () => {
  it('should send the legacy fingerprint the server still knows', async () => {
    await signIn();
    await AsyncStorage.setItem(LEGACY_KEY, LEGACY);

    const record = await magicLinkService.captureDeviceDeactivation();

    expect(record.fingerprint).toBe(LEGACY);
  });

  it('should send the new fingerprint once migrated', async () => {
    await signIn();
    const fp = await fingerprint.getOrCreateDeviceFingerprint();

    const record = await magicLinkService.captureDeviceDeactivation();

    expect(record.fingerprint).toBe(fp);
  });
});
