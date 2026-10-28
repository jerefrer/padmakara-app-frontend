import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '@/services/apiService';
import passkeyClient from '@/services/passkeyClient';
import * as tokenStorage from '@/services/tokenStorage';
import {
  isPasskeySupported,
  listPasskeys,
  registerPasskey,
  removePasskey,
  signInWithPasskey,
  supportsPasskeyAutofill,
} from '@/services/passkeyService';

jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));
jest.mock('expo-device', () => ({ deviceName: 'Test phone', modelName: 'Test' }));
jest.mock('@/services/tokenStorage', () => ({
  setAuthToken: jest.fn().mockResolvedValue(undefined),
  setRefreshToken: jest.fn().mockResolvedValue(undefined),
  getAuthToken: jest.fn(),
  getRefreshToken: jest.fn(),
  deleteAuthToken: jest.fn(),
  deleteRefreshToken: jest.fn(),
  getPendingDeactivationRaw: jest.fn(),
  setPendingDeactivationRaw: jest.fn(),
  deletePendingDeactivation: jest.fn(),
}));
jest.mock('@/services/passkeyClient', () => ({
  __esModule: true,
  default: {
    isSupported: jest.fn(),
    supportsAutofill: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    isCancelled: jest.fn(),
    defaultName: jest.fn(),
  },
}));

const api = apiService as unknown as { get: jest.Mock; post: jest.Mock; delete: jest.Mock };
const client = passkeyClient as unknown as Record<string, jest.Mock>;
const ts = tokenStorage as unknown as Record<string, jest.Mock>;

const loginOptions = { success: true, data: { challengeId: 'c1', options: { challenge: 'abc' } } };
const credential = { id: 'cred', response: { signature: 'sig' } };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  client.isCancelled.mockImplementation((e: any) => e?.name === 'NotAllowedError');
});

describe('signInWithPasskey', () => {
  it('should store tokens when passkey sign-in succeeds', async () => {
    api.post.mockResolvedValueOnce(loginOptions).mockResolvedValueOnce({
      success: true,
      data: { status: 'already_activated', access_token: 'acc', refresh_token: 'ref', user: { id: '7' } },
    });
    client.get.mockResolvedValue(credential);

    const res = await signInWithPasskey();

    expect(res).toEqual({ ok: true });
    expect(ts.setAuthToken).toHaveBeenCalledWith('acc');
    expect(ts.setRefreshToken).toHaveBeenCalledWith('ref');
    expect(await AsyncStorage.getItem('device_activated')).toBe('true');
    expect(api.post.mock.calls[0][0]).toBe('/auth/passkeys/login/options');
    expect(api.post.mock.calls[1][0]).toBe('/auth/passkeys/login/verify');
  });

  it('should send device info with login verify', async () => {
    api.post.mockResolvedValueOnce(loginOptions).mockResolvedValueOnce({
      success: true,
      data: { access_token: 'acc', refresh_token: 'ref', user: { id: '7' } },
    });
    client.get.mockResolvedValue(credential);

    await signInWithPasskey();

    const body = api.post.mock.calls[1][1];
    expect(body).toMatchObject({ challengeId: 'c1', response: credential, device_name: 'Test phone' });
    expect(body.device_fingerprint).toBeTruthy();
    expect(body.device_type).toBeTruthy();
  });

  it('should report cancelled when the person dismisses the system sheet', async () => {
    api.post.mockResolvedValueOnce(loginOptions);
    client.get.mockRejectedValue(Object.assign(new Error('dismissed'), { name: 'NotAllowedError' }));

    const res = await signInWithPasskey();

    expect(res).toEqual({ ok: false, cancelled: true });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(ts.setAuthToken).not.toHaveBeenCalled();
  });

  it('should report not cancelled when the server refuses', async () => {
    api.post
      .mockResolvedValueOnce(loginOptions)
      .mockResolvedValueOnce({ success: false, error: 'Passkey sign-in failed', status: 401 });
    client.get.mockResolvedValue(credential);

    const res = await signInWithPasskey();

    expect(res).toEqual({ ok: false, cancelled: false });
    expect(ts.setAuthToken).not.toHaveBeenCalled();
  });

  it('should report not cancelled when the options request fails', async () => {
    api.post.mockResolvedValueOnce({ success: false, error: 'HTTP 500', status: 500 });

    const res = await signInWithPasskey();

    expect(res).toEqual({ ok: false, cancelled: false });
    expect(client.get).not.toHaveBeenCalled();
  });

  it('should pass autofill and signal to the client', async () => {
    api.post.mockResolvedValueOnce(loginOptions);
    client.get.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'NotAllowedError' }));
    const controller = new AbortController();

    await signInWithPasskey({ autofill: true, signal: controller.signal });

    expect(client.get).toHaveBeenCalledWith({ challenge: 'abc' }, { autofill: true, signal: controller.signal });
  });
});

describe('registerPasskey', () => {
  it('should send the credential and the derived name when registration succeeds', async () => {
    api.post
      .mockResolvedValueOnce({ success: true, data: { challengeId: 'r1', options: { challenge: 'xyz' } } })
      .mockResolvedValueOnce({ success: true, data: { passkey: { id: 1 } } });
    client.create.mockResolvedValue(credential);
    client.defaultName.mockReturnValue('iPhone');

    const res = await registerPasskey();

    expect(res).toEqual({ ok: true });
    expect(api.post.mock.calls[1]).toEqual([
      '/auth/passkeys/register/verify',
      { challengeId: 'r1', response: credential, name: 'iPhone' },
    ]);
  });

  it('should report cancelled when the person dismisses the system sheet', async () => {
    api.post.mockResolvedValueOnce({ success: true, data: { challengeId: 'r1', options: {} } });
    client.create.mockRejectedValue(Object.assign(new Error('dismissed'), { name: 'NotAllowedError' }));

    expect(await registerPasskey()).toEqual({ ok: false, cancelled: true });
  });

  it('should report not cancelled when the server refuses the credential', async () => {
    api.post
      .mockResolvedValueOnce({ success: true, data: { challengeId: 'r1', options: {} } })
      .mockResolvedValueOnce({ success: false, error: 'bad', status: 400 });
    client.create.mockResolvedValue(credential);

    expect(await registerPasskey()).toEqual({ ok: false, cancelled: false });
  });
});

describe('support checks', () => {
  it('should delegate isPasskeySupported and supportsPasskeyAutofill to the client', async () => {
    client.isSupported.mockResolvedValue(true);
    client.supportsAutofill.mockResolvedValue(false);

    expect(await isPasskeySupported()).toBe(true);
    expect(await supportsPasskeyAutofill()).toBe(false);
  });

  it('should treat a throwing client as unsupported', async () => {
    client.isSupported.mockRejectedValue(new Error('boom'));
    client.supportsAutofill.mockRejectedValue(new Error('boom'));

    expect(await isPasskeySupported()).toBe(false);
    expect(await supportsPasskeyAutofill()).toBe(false);
  });
});

describe('listPasskeys and removePasskey', () => {
  it('should return the passkeys the server lists', async () => {
    const passkeys = [{ id: 1, name: 'iPhone', createdAt: 'a', lastUsedAt: null }];
    api.get.mockResolvedValue({ success: true, data: { passkeys } });

    expect(await listPasskeys()).toEqual(passkeys);
    expect(api.get).toHaveBeenCalledWith('/auth/passkeys');
  });

  it('should return an empty list when the request fails', async () => {
    api.get.mockResolvedValue({ success: false, error: 'x' });

    expect(await listPasskeys()).toEqual([]);
  });

  it('should report whether the removal succeeded', async () => {
    api.delete.mockResolvedValueOnce({ success: true, data: '' }).mockResolvedValueOnce({ success: false, status: 404 });

    expect(await removePasskey(3)).toBe(true);
    expect(api.delete).toHaveBeenCalledWith('/auth/passkeys/3');
    expect(await removePasskey(4)).toBe(false);
  });
});
