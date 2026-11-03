import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';

import {
  offerNotificationExplainer,
  shouldShowExplainer,
  subscribeToExplainer,
} from './notificationPermission';

const setPlatform = (os: string, version: number | string) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
};

describe('shouldShowExplainer', () => {
  const base = { os: 'android', version: 34, asked: false, granted: false };

  it('should show on Android 13+ when not granted and not asked', () => {
    expect(shouldShowExplainer(base)).toBe(true);
  });
  it('should not show when already asked', () => {
    expect(shouldShowExplainer({ ...base, asked: true })).toBe(false);
  });
  it('should not show when granted', () => {
    expect(shouldShowExplainer({ ...base, granted: true })).toBe(false);
  });
  it('should not show below Android 13', () => {
    expect(shouldShowExplainer({ ...base, version: 32 })).toBe(false);
  });
  it.each(['ios', 'web'])('should not show on %s', (os) => {
    expect(shouldShowExplainer({ ...base, os })).toBe(false);
  });
});

describe('offerNotificationExplainer', () => {
  let checkSpy: jest.SpyInstance;
  let listener: jest.Mock;
  let unsubscribe: () => void;

  beforeEach(async () => {
    await AsyncStorage.clear();
    checkSpy = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    listener = jest.fn();
    unsubscribe = subscribeToExplainer(listener);
    setPlatform('android', 34);
  });

  afterEach(() => {
    unsubscribe();
    jest.restoreAllMocks();
  });

  it('should notify the explainer on first play', async () => {
    await offerNotificationExplainer();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should show only once even when dismissed', async () => {
    await offerNotificationExplainer();
    await offerNotificationExplainer();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should not use up the chance when no explainer is mounted', async () => {
    unsubscribe();
    await offerNotificationExplainer();
    unsubscribe = subscribeToExplainer(listener);
    await offerNotificationExplainer();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should stay silent when the permission is granted', async () => {
    checkSpy.mockResolvedValue(true);
    await offerNotificationExplainer();
    expect(listener).not.toHaveBeenCalled();
  });

  it.each([['ios', '17.0'], ['web', 0], ['android', 32]])('should stay silent on %s %s', async (os, version) => {
    setPlatform(os, version);
    await offerNotificationExplainer();
    expect(listener).not.toHaveBeenCalled();
  });

  it('should not throw when storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(offerNotificationExplainer()).resolves.toBeUndefined();
  });
});
