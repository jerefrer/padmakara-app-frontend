import React from 'react';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { LockScreenControlsRow } from '@/components/settings/LockScreenControlsRow';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

const setPlatform = (os: string, version: number | string) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
};

let checkSpy: jest.SpyInstance;
let requestSpy: jest.SpyInstance;
let settingsSpy: jest.SpyInstance;

beforeEach(() => {
  setPlatform('android', 34);
  checkSpy = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  requestSpy = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
  settingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

const renderRow = async () => {
  const screen = render(<LockScreenControlsRow />);
  await act(async () => {});
  return screen;
};

describe('LockScreenControlsRow', () => {
  it('should be hidden on iOS', async () => {
    setPlatform('ios', '17.0');
    const screen = await renderRow();
    expect(screen.queryByText('Lock-screen controls')).toBeNull();
  });

  it('should be hidden on the web', async () => {
    setPlatform('web', 0);
    const screen = await renderRow();
    expect(screen.queryByText('Lock-screen controls')).toBeNull();
  });

  it('should show Off and a Turn on button when denied', async () => {
    const screen = await renderRow();
    expect(screen.getByText('Off')).toBeTruthy();
    expect(screen.getByText('Turn on')).toBeTruthy();
  });

  it('should show On without a button when granted', async () => {
    checkSpy.mockResolvedValue(true);
    const screen = await renderRow();
    expect(screen.getByText('On')).toBeTruthy();
    expect(screen.queryByText('Turn on')).toBeNull();
  });

  it('should show On below Android 13 without checking', async () => {
    setPlatform('android', 31);
    const screen = await renderRow();
    expect(screen.getByText('On')).toBeTruthy();
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it('should open the phone settings with a hint when Android will not ask again', async () => {
    requestSpy.mockResolvedValue('never_ask_again');
    const screen = await renderRow();
    await act(async () => {
      fireEvent.press(screen.getByText('Turn on'));
    });
    expect(settingsSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Allow notifications in your phone's settings.")).toBeTruthy();
  });

  it('should switch to On without opening settings when the user allows', async () => {
    requestSpy.mockResolvedValue('granted');
    const screen = await renderRow();
    checkSpy.mockResolvedValue(true);
    await act(async () => {
      fireEvent.press(screen.getByText('Turn on'));
    });
    expect(settingsSpy).not.toHaveBeenCalled();
    expect(screen.getByText('On')).toBeTruthy();
  });
});
