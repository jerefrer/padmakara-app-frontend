import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { PlaybackSection, SignInSection } from '@/components/settings/DeviceSections';
import { visibleSections } from '@/components/settings/sections';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('expo-local-authentication', () => ({}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => ({ clearTrack: jest.fn() }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ forgetDevice: jest.fn() }) }));
jest.mock('@/contexts/AppLockContext', () => ({
  useAppLock: () => ({ enabled: false, kind: null, enable: jest.fn(), disable: jest.fn() }),
}));
jest.mock('@/components/settings/PasskeySettings', () => ({ PasskeySettings: () => null }));
jest.mock('@/components/StorageSection', () => ({ StorageSection: () => null }));
jest.mock('@/services/videoPreferencesService', () => ({
  __esModule: true,
  default: {
    getWarnOnCellular: jest.fn(() => Promise.resolve(true)),
    getAllowOnCellular: jest.fn(() => Promise.resolve(true)),
  },
}));

const originalOS = Platform.OS;
afterEach(() => { (Platform as { OS: string }).OS = originalOS; });

describe('Playback section', () => {
  it('should hold the lock screen buttons choice on iOS', () => {
    (Platform as { OS: string }).OS = 'ios';
    const view = render(<PlaybackSection />);
    expect(view.getByTestId('settings-lock-screen-buttons')).toBeTruthy();
    expect(view.getByTestId('lock-screen-buttons-seconds')).toBeTruthy();
  });

  it('should not hold the lock screen buttons choice on Android', () => {
    (Platform as { OS: string }).OS = 'android';
    const view = render(<PlaybackSection />);
    expect(view.queryByTestId('settings-lock-screen-buttons')).toBeNull();
  });

  it('should no longer show the lock screen buttons under Sign-in & security', () => {
    (Platform as { OS: string }).OS = 'ios';
    const view = render(<SignInSection />);
    expect(view.queryByTestId('settings-lock-screen-buttons')).toBeNull();
    expect(view.queryByTestId('settings-lock-screen-controls')).toBeNull();
  });

  it('should list the Playback section on native and hide it on the web', () => {
    expect(visibleSections({ isWeb: false, isAuthenticated: true }).some((s) => s.id === 'video')).toBe(true);
    expect(visibleSections({ isWeb: true, isAuthenticated: true }).some((s) => s.id === 'video')).toBe(false);
  });
});
