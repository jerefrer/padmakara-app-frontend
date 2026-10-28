import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { SignInSection } from '@/components/settings/DeviceSections';

let mockLock: any;

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn(), forgetDevice: jest.fn() }),
}));
jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => ({ clearTrack: jest.fn() }),
}));
jest.mock('@/contexts/AppLockContext', () => ({ useAppLock: () => mockLock }));
jest.mock('@/components/settings/PasskeySettings', () => ({ PasskeySettings: () => null }));
jest.mock('@/components/StorageSection', () => ({ StorageSection: () => null }));
jest.mock('@/services/videoPreferencesService', () => ({}));

const originalOS = Platform.OS;
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

beforeEach(() => {
  setOS('ios');
  mockLock = {
    enabled: false,
    locked: false,
    kind: 'faceId',
    unlock: jest.fn(),
    enable: jest.fn(async () => true),
    disable: jest.fn(async () => true),
  };
});
afterEach(() => setOS(originalOS));

const toggle = (screen: ReturnType<typeof render>, value: boolean) =>
  act(async () => {
    fireEvent(screen.getByRole('switch'), 'valueChange', value);
  });

describe('app lock setting', () => {
  it('should ask for authentication when turning the lock on', async () => {
    const screen = render(<SignInSection />);
    await toggle(screen, true);
    expect(mockLock.enable).toHaveBeenCalledTimes(1);
  });

  it('should keep the switch off when the authentication fails', async () => {
    mockLock.enable = jest.fn(async () => false);
    const screen = render(<SignInSection />);
    await toggle(screen, true);
    expect(mockLock.enable).toHaveBeenCalled();
    expect(screen.getByRole('switch').props.value).toBe(false);
  });

  it('should ask for authentication when turning the lock off', async () => {
    mockLock.enabled = true;
    const screen = render(<SignInSection />);
    await toggle(screen, false);
    expect(mockLock.disable).toHaveBeenCalledTimes(1);
  });

  it('should be disabled with a setup hint when no biometric is set up', () => {
    mockLock.kind = null;
    const screen = render(<SignInSection />);
    expect(screen.getByText('Set up Face ID or a passcode on this device first.')).toBeTruthy();
    expect(screen.getByRole('switch').props.disabled).toBe(true);
  });

  it('should name the biometric in the title when Face ID is available', () => {
    const screen = render(<SignInSection />);
    expect(screen.getByText('Lock with Face ID')).toBeTruthy();
  });

  it('should not show the row when running on the web', () => {
    setOS('web');
    const screen = render(<SignInSection />);
    expect(screen.queryByText('Lock with Face ID')).toBeNull();
  });
});
