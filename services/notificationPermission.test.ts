import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';

import { requestNotificationPermissionOnce } from './notificationPermission';

const setPlatform = (os: string, version: number | string) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
};

describe('requestNotificationPermissionOnce', () => {
  let requestSpy: jest.SpyInstance;
  let checkSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    requestSpy = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
    checkSpy = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should ask on Android 13 and above', async () => {
    setPlatform('android', 34);
    await requestNotificationPermissionOnce();
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('should ask only once even after a denial', async () => {
    setPlatform('android', 34);
    await requestNotificationPermissionOnce();
    await requestNotificationPermissionOnce();
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('should not ask when the permission is already granted', async () => {
    setPlatform('android', 33);
    checkSpy.mockResolvedValue(true);
    await requestNotificationPermissionOnce();
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('should not ask on Android 12', async () => {
    setPlatform('android', 32);
    await requestNotificationPermissionOnce();
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it.each([['ios', '17.0'], ['web', 0]])('should never ask on %s', async (os, version) => {
    setPlatform(os, version);
    await requestNotificationPermissionOnce();
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('should not throw when the request fails', async () => {
    setPlatform('android', 34);
    requestSpy.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(requestNotificationPermissionOnce()).resolves.toBeUndefined();
  });
});
