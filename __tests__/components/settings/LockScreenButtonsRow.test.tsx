import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LockScreenButtonsRow } from '@/components/settings/LockScreenButtonsRow';
import { getLockScreenButtons } from '@/services/lockScreenButtonsPreference';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));

describe('LockScreenButtonsRow', () => {
  const originalOS = Platform.OS;
  afterEach(() => { (Platform as { OS: string }).OS = originalOS; });

  it('should render nothing on Android, which shows every button', () => {
    (Platform as { OS: string }).OS = 'android';
    const view = render(<LockScreenButtonsRow />);
    expect(view.toJSON()).toBeNull();
  });

  it('should offer the two choices on iOS and save the one pressed', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const view = render(<LockScreenButtonsRow />);
    expect(view.getByText('lockScreen.buttonsSeconds')).toBeTruthy();

    fireEvent.press(view.getByTestId('lock-screen-buttons-tracks'));

    await waitFor(async () => expect(await getLockScreenButtons()).toBe('tracks'));
  });
});
