import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { SignInForm } from '@/components/auth/SignInForm';
import magicLinkService from '@/services/magicLinkService';

const mockRefreshAuth = jest.fn(() => Promise.resolve());

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text testID={`icon-${props.name}`}>{props.color}</Text> };
});
jest.mock('@/services/passkeyService', () => ({
  isPasskeySupported: () => Promise.resolve(false),
  supportsPasskeyAutofill: () => Promise.resolve(false),
  signInWithPasskey: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ refreshAuth: mockRefreshAuth }) }));
jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: { requestMagicLink: jest.fn(), checkActivationStatus: jest.fn(), reviewLogin: jest.fn() },
}));

const request = magicLinkService.requestMagicLink as jest.Mock;
const reviewLogin = magicLinkService.reviewLogin as jest.Mock;

beforeEach(() => jest.clearAllMocks());

// The inline Settings card (iPad and desktop) renders SignInForm in its "card" variant.
async function openCodeStep() {
  request.mockResolvedValueOnce({ success: true, data: { status: 'code_required' } });
  const utils = render(<SignInForm variant="card" />);
  fireEvent.changeText(utils.getByTestId('sign-in-email'), 'review@padmakara.pt');
  await act(async () => {
    fireEvent.press(utils.getByTestId('sign-in-submit'));
  });
  return utils;
}

describe('SignInForm card, review code', () => {
  it('should show the code field when the server asks for a code', async () => {
    const { getByTestId, getByText } = await openCodeStep();
    expect(getByTestId('review-code-input')).toBeTruthy();
    expect(getByText('Review code')).toBeTruthy();
  });

  it('should sign in with the right code', async () => {
    const { getByTestId } = await openCodeStep();
    reviewLogin.mockResolvedValueOnce({ success: true, data: { status: 'already_activated' } });
    fireEvent.changeText(getByTestId('review-code-input'), 'demo-code-1');
    await act(async () => {
      fireEvent.press(getByTestId('review-code-submit'));
    });
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(getByTestId('sign-in-done')).toBeTruthy();
  });

  it('should show an error when the code is wrong', async () => {
    const { getByTestId, getByText } = await openCodeStep();
    reviewLogin.mockResolvedValueOnce({ success: false, incorrectCode: true });
    fireEvent.changeText(getByTestId('review-code-input'), 'wrong-code');
    await act(async () => {
      fireEvent.press(getByTestId('review-code-submit'));
    });
    expect(getByText('Incorrect code')).toBeTruthy();
  });
});
