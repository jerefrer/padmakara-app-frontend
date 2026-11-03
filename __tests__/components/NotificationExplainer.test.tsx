import React from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render } from '@testing-library/react-native';

import { NotificationExplainer } from '@/components/NotificationExplainer';
import { offerNotificationExplainer } from '@/services/notificationPermission';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

let requestSpy: jest.SpyInstance;

beforeEach(async () => {
  await AsyncStorage.clear();
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => 34 });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  requestSpy = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
});
afterEach(() => jest.restoreAllMocks());

const open = async () => {
  const screen = render(<NotificationExplainer />);
  await act(async () => {
    await offerNotificationExplainer();
  });
  return screen;
};

describe('NotificationExplainer', () => {
  it('should stay hidden until audio plays', () => {
    const screen = render(<NotificationExplainer />);
    expect(screen.queryByText('Lock-screen controls')).toBeNull();
  });

  it('should show the explanation without asking the system yet', async () => {
    const screen = await open();
    expect(screen.getByText('Lock-screen controls')).toBeTruthy();
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('should ask the system when Continue is pressed', async () => {
    const screen = await open();
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('should close without asking the system when Not now is pressed, and never return', async () => {
    const screen = await open();
    await act(async () => {
      fireEvent.press(screen.getByText('Not now'));
    });
    expect(requestSpy).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('notificationPermission.asked.v1')).toBe('1');
    await act(async () => {
      await offerNotificationExplainer();
    });
    expect(screen.queryByText('Not now')).toBeNull();
  });
});
