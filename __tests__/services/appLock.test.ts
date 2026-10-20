import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  authenticate,
  biometricKind,
  getAppLockEnabled,
  isNothingToAskFor,
  setAppLockEnabled,
} from '@/services/appLock';

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const store = SecureStore as jest.Mocked<typeof SecureStore>;
const originalOS = Platform.OS;
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

function device(types: number[], { hardware = true, enrolled = true } = {}) {
  auth.hasHardwareAsync.mockResolvedValue(hardware);
  auth.isEnrolledAsync.mockResolvedValue(enrolled);
  auth.supportedAuthenticationTypesAsync.mockResolvedValue(types as any);
}

afterEach(() => setOS(originalOS));

describe('biometricKind', () => {
  it('should return faceId when an iPhone supports facial recognition', async () => {
    setOS('ios');
    device([2]);
    expect(await biometricKind()).toBe('faceId');
  });

  it('should return touchId when an iPhone only supports fingerprints', async () => {
    setOS('ios');
    device([1]);
    expect(await biometricKind()).toBe('touchId');
  });

  it('should return fingerprint when an Android phone supports fingerprints', async () => {
    setOS('android');
    device([1]);
    expect(await biometricKind()).toBe('fingerprint');
  });

  it('should return biometrics when an Android phone only supports facial recognition', async () => {
    setOS('android');
    device([2]);
    expect(await biometricKind()).toBe('biometrics');
  });

  it('should return null when nothing is enrolled', async () => {
    setOS('ios');
    device([2], { enrolled: false });
    expect(await biometricKind()).toBeNull();
  });

  it('should return null when the device has no biometric hardware', async () => {
    setOS('android');
    device([], { hardware: false });
    expect(await biometricKind()).toBeNull();
  });

  it('should return null without asking the device when running on the web', async () => {
    setOS('web');
    expect(await biometricKind()).toBeNull();
    expect(auth.hasHardwareAsync).not.toHaveBeenCalled();
  });
});

describe('app lock flag', () => {
  it('should read true when the secure store holds "true"', async () => {
    setOS('ios');
    store.getItemAsync.mockResolvedValue('true');
    expect(await getAppLockEnabled()).toBe(true);
  });

  it('should read false when nothing is stored', async () => {
    setOS('ios');
    store.getItemAsync.mockResolvedValue(null);
    expect(await getAppLockEnabled()).toBe(false);
  });

  it('should write the flag to the secure store when enabling', async () => {
    setOS('ios');
    await setAppLockEnabled(true);
    expect(store.setItemAsync).toHaveBeenCalledWith('app_lock_enabled', 'true');
  });

  it('should delete the flag from the secure store when disabling', async () => {
    setOS('android');
    await setAppLockEnabled(false);
    expect(store.deleteItemAsync).toHaveBeenCalledWith('app_lock_enabled');
  });

  it('should be false and touch no storage when running on the web', async () => {
    setOS('web');
    await setAppLockEnabled(true);
    expect(await getAppLockEnabled()).toBe(false);
    expect(store.setItemAsync).not.toHaveBeenCalled();
    expect(store.getItemAsync).not.toHaveBeenCalled();
  });
});

describe('authenticate', () => {
  it('should allow the device passcode fallback when prompting', async () => {
    setOS('ios');
    auth.authenticateAsync.mockResolvedValue({ success: true } as any);
    const result = await authenticate({ promptMessage: 'Unlock', cancelLabel: 'Cancel' });
    expect(result).toEqual({ success: true });
    expect(auth.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Unlock',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
  });

  it('should report the error code when the prompt fails', async () => {
    setOS('ios');
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' } as any);
    expect(await authenticate({ promptMessage: 'Unlock' })).toEqual({ success: false, error: 'user_cancel' });
  });

  it('should fail without prompting when running on the web', async () => {
    setOS('web');
    expect((await authenticate({ promptMessage: 'Unlock' })).success).toBe(false);
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });
});

describe('isNothingToAskFor', () => {
  it.each(['not_enrolled', 'passcode_not_set'])('should be true when the error is %s', (error) => {
    expect(isNothingToAskFor(error)).toBe(true);
  });

  it('should be false when the person simply cancelled', () => {
    expect(isNothingToAskFor('user_cancel')).toBe(false);
  });
});
