import { Platform } from 'react-native';
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
jest.mock('expo-device', () => ({ deviceName: null, modelName: null }));

const crypto = Crypto as jest.Mocked<typeof Crypto>;
const store = SecureStore as jest.Mocked<typeof SecureStore>;
const post = (apiService as unknown as { post: jest.Mock }).post;
const originalOS = Platform.OS;
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

let secure: Map<string, string>;
let magicLinkService: typeof import('@/services/magicLinkService').default;

function launch() {
  jest.isolateModules(() => {
    magicLinkService = require('@/services/magicLinkService').default;
  });
}

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

describe('sign-in when the fingerprint cannot be stored', () => {
  beforeEach(() => {
    store.setItemAsync.mockRejectedValue(new Error('keychain unavailable'));
  });

  it('should not send a request and should say the device storage is unavailable', async () => {
    const res = await magicLinkService.requestMagicLink('ana@example.pt', 'en');

    expect(post).not.toHaveBeenCalled();
    expect(res).toMatchObject({ success: false, deviceUnavailable: true });
  });

  it('should report it for the email code too', async () => {
    const res = await magicLinkService.verifyEmailCode('ana@example.pt', '123456');

    expect(post).not.toHaveBeenCalled();
    expect(res).toMatchObject({ success: false, deviceUnavailable: true });
  });

  it('should report it for the review code too', async () => {
    const res = await magicLinkService.reviewLogin('review@padmakara.pt', 'demo-code');

    expect(post).not.toHaveBeenCalled();
    expect(res).toMatchObject({ success: false, deviceUnavailable: true });
  });
});
