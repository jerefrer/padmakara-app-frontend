import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { SignInSection } from '@/components/settings/DeviceSections';

const mockReplace = jest.fn();
const mockForgetDevice = jest.fn();
const mockLogout = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({ router: { replace: (...a: any[]) => mockReplace(...a), push: jest.fn() } }));
jest.mock('expo-local-authentication', () => ({}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => ({ clearTrack: jest.fn() }) }));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { preferences: {} },
    enableBiometric: jest.fn(),
    disableBiometric: jest.fn(),
    logout: mockLogout,
    forgetDevice: mockForgetDevice,
  }),
}));
jest.mock('@/components/settings/PasskeySettings', () => ({ PasskeySettings: () => null }));
jest.mock('@/components/StorageSection', () => ({ StorageSection: () => null }));
jest.mock('@/services/videoPreferencesService', () => ({ __esModule: true, default: {} }));

const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = 'web';
  (window as any).confirm = jest.fn(() => true);
  (window as any).alert = jest.fn();
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('SignInSection', () => {
  it('should offer one sign-out row and no separate forget-device row', () => {
    const { getByTestId, queryByTestId, getByText } = render(<SignInSection />);
    expect(getByTestId('settings-sign-out')).toBeTruthy();
    expect(getByText('Sign out of this device')).toBeTruthy();
    expect(queryByTestId('settings-forget-device')).toBeNull();
  });

  it('should forget the device and not just log out when the person confirms', async () => {
    mockForgetDevice.mockResolvedValue({ complete: true });
    const { getByTestId } = render(<SignInSection />);
    await act(async () => {
      fireEvent.press(getByTestId('settings-sign-out'));
    });
    expect(mockForgetDevice).toHaveBeenCalledTimes(1);
    expect(window.confirm).toHaveBeenCalledTimes(1); // only the sign-out confirmation
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(groups)');
  });

  it('should keep the device when the person cancels the confirmation', async () => {
    (window as any).confirm = jest.fn(() => false);
    const { getByTestId } = render(<SignInSection />);
    await act(async () => {
      fireEvent.press(getByTestId('settings-sign-out'));
    });
    expect(mockForgetDevice).not.toHaveBeenCalled();
  });

  it('should tell the person to restart the app when some data could not be removed', async () => {
    mockForgetDevice.mockResolvedValue({ complete: false });
    const { getByTestId } = render(<SignInSection />);
    await act(async () => {
      fireEvent.press(getByTestId('settings-sign-out'));
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(groups)');
    expect(window.confirm).toHaveBeenCalledTimes(1); // the confirmation; the notice has nothing to choose
    expect((window.alert as jest.Mock).mock.calls[0][0]).toContain('Restart the app to finish');
  });
});
