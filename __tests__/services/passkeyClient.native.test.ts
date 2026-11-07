import { NativeModules, Platform } from 'react-native';

import { Passkey } from 'react-native-passkey';
import passkeyClient from '@/services/passkeyClient.native';

jest.mock('react-native-passkey', () => ({
  Passkey: { isSupported: jest.fn(() => true), create: jest.fn(), get: jest.fn(), getImmediate: jest.fn() },
}));

const originalOS = Platform.OS;
const original = NativeModules.Passkey;
afterEach(() => {
  (Platform as any).OS = originalOS;
  NativeModules.Passkey = original;
});

describe('native passkey client isSupported', () => {
  it('should be supported on iOS when the native module is linked', async () => {
    (Platform as any).OS = 'ios';
    NativeModules.Passkey = {};

    expect(await passkeyClient.isSupported()).toBe(true);
  });

  it('should not be supported when the native module is missing (Expo Go, older dev client)', async () => {
    (Platform as any).OS = 'ios';
    NativeModules.Passkey = undefined;

    expect(await passkeyClient.isSupported()).toBe(false);
  });
});

describe('native passkey client get', () => {
  const result = { id: 'a', rawId: 'a', response: {}, authenticatorAttachment: 'platform' };

  it('should only use a key already on this device, so iOS never opens its QR code sheet', async () => {
    (Passkey.getImmediate as jest.Mock).mockResolvedValue(result);

    await passkeyClient.get({ challenge: 'c' });

    expect(Passkey.getImmediate).toHaveBeenCalledTimes(1);
    expect(Passkey.get).not.toHaveBeenCalled();
  });

  it('should recognise the error for a device with no key', () => {
    expect(passkeyClient.isNoCredential({ error: 'NoCredentials' })).toBe(true);
    expect(passkeyClient.isNoCredential({ error: 'UserCancelled' })).toBe(false);
  });
});
