import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';

import { AboutSection } from '@/components/settings/DeviceSections';

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
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({}) }));
jest.mock('@/components/settings/PasskeySettings', () => ({ PasskeySettings: () => null }));
jest.mock('@/components/StorageSection', () => ({ StorageSection: () => null }));
jest.mock('@/services/videoPreferencesService', () => ({ __esModule: true, default: {} }));

const originalOS = Platform.OS;
beforeEach(() => {
  (Platform as any).OS = 'web';
  (window as any).confirm = jest.fn(() => true);
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

function tapVersion(times: number) {
  const { getByTestId } = render(<AboutSection />);
  for (let i = 0; i < times; i++) fireEvent.press(getByTestId('settings-version'));
}

describe('AboutSection', () => {
  it('should send a Sentry test report and confirm it after seven taps on the version', () => {
    tapVersion(7);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect((Sentry.captureException as jest.Mock).mock.calls[0][0].message).toMatch(/Sentry test report/);
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it('should send nothing after fewer taps', () => {
    tapVersion(6);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
