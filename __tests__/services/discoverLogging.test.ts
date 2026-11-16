import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import apiService from '@/services/apiService';
import magicLinkService from '@/services/magicLinkService';

jest.mock('expo-crypto', () => ({ getRandomBytesAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('@/services/apiService', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('expo-device', () => ({ deviceName: 'Test', modelName: 'Test' }));

const crypto = Crypto as jest.Mocked<typeof Crypto>;
const store = SecureStore as jest.Mocked<typeof SecureStore>;
const post = (apiService as unknown as { post: jest.Mock }).post;

const SECRETS = ['access-secret', 'refresh-secret'];

function loggedText(): string {
  const calls = (['log', 'info', 'warn', 'error', 'debug'] as const).flatMap(
    (level) => (console[level] as unknown as jest.Mock).mock.calls,
  );
  return calls.map((args) => args.map((a: unknown) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')).join('\n');
}

beforeEach(() => {
  const secure = new Map<string, string>();
  store.getItemAsync.mockImplementation(async (key: string) => secure.get(key) ?? null);
  store.setItemAsync.mockImplementation(async (key: string, value: string) => {
    secure.set(key, value);
  });
  store.deleteItemAsync.mockImplementation(async (key: string) => {
    secure.delete(key);
  });
  crypto.getRandomBytesAsync.mockResolvedValue(Uint8Array.from({ length: 32 }, (_, i) => i));
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    jest.spyOn(console, level).mockImplementation(() => {});
  }
});

describe('logging', () => {
  it('should not print the tokens returned by device discovery', async () => {
    post.mockResolvedValue({
      success: true,
      data: { status: 'activated', access_token: SECRETS[0], refresh_token: SECRETS[1], user: { id: 7 } },
    });

    const res = await magicLinkService.checkActivationStatus();

    expect(res.data?.isActivated).toBe(true);
    const text = loggedText();
    for (const secret of SECRETS) expect(text).not.toContain(secret);
  });

  it('should not print the device fingerprint', async () => {
    const fp = (await magicLinkService.getDeviceInfo()).fingerprint;

    await magicLinkService.getDeviceActivationInfo();

    expect(loggedText()).not.toContain(fp);
  });
});
