import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { LockScreenButtonsRow } from '@/components/settings/LockScreenButtonsRow';
import { getLockScreenButtons } from '@/services/lockScreenButtonsPreference';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text testID={`icon-${props.name}`}>{props.name}</Text> };
});
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

  it('should render nothing on the web', () => {
    (Platform as { OS: string }).OS = 'web';
    expect(render(<LockScreenButtonsRow />).toJSON()).toBeNull();
  });

  it('should show a caption, an explanation and two choices without a navigation icon on iOS', () => {
    (Platform as { OS: string }).OS = 'ios';
    const view = render(<LockScreenButtonsRow />);
    expect(view.getByText('lockScreen.buttons')).toBeTruthy();
    expect(view.getByText('lockScreen.buttonsExplanation')).toBeTruthy();
    expect(view.getByText('lockScreen.buttonsSeconds')).toBeTruthy();
    expect(view.getByText('lockScreen.buttonsTracks')).toBeTruthy();
    expect(view.queryByTestId('icon-play-skip-forward-outline')).toBeNull();
  });

  it('should save the choice pressed and move the check to it', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const view = render(<LockScreenButtonsRow />);

    fireEvent.press(view.getByTestId('lock-screen-buttons-seconds'));
    await waitFor(async () => expect(await getLockScreenButtons()).toBe('seconds'));
    await waitFor(() => expect(view.getAllByTestId('icon-checkmark')).toHaveLength(1));

    fireEvent.press(view.getByTestId('lock-screen-buttons-tracks'));
    await waitFor(async () => expect(await getLockScreenButtons()).toBe('tracks'));
    await waitFor(() => {
      expect(within(view.getByTestId('lock-screen-buttons-tracks')).queryByTestId('icon-checkmark')).toBeTruthy();
      expect(within(view.getByTestId('lock-screen-buttons-seconds')).queryByTestId('icon-checkmark')).toBeNull();
    });
  });
});
