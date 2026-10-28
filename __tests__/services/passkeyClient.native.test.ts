import { NativeModules, Platform } from 'react-native';

import passkeyClient from '@/services/passkeyClient.native';

jest.mock('react-native-passkey', () => ({
  Passkey: { isSupported: jest.fn(() => true), create: jest.fn(), get: jest.fn() },
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
