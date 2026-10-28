import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { SignInForm } from '@/components/auth/SignInForm';
import magicLinkService from '@/services/magicLinkService';

const mockRefreshAuth = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ refreshAuth: mockRefreshAuth }) }));
jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: {
    requestMagicLink: jest.fn(),
    checkActivationStatus: jest.fn(),
    reviewLogin: jest.fn(),
    verifyEmailCode: jest.fn(),
  },
}));

const request = magicLinkService.requestMagicLink as jest.Mock;
const check = magicLinkService.checkActivationStatus as jest.Mock;
const verify = magicLinkService.verifyEmailCode as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  mockRefreshAuth.mockResolvedValue(undefined as never);
  check.mockResolvedValue({ success: true, data: { isActivated: false } });
});

async function openSentStep() {
  request.mockResolvedValueOnce({ success: true, data: { status: 'magic_link_sent' } });
  const utils = render(<SignInForm />);
  fireEvent.changeText(utils.getByTestId('sign-in-email'), 'ana@example.pt');
  await act(async () => {
    fireEvent.press(utils.getByTestId('sign-in-submit'));
  });
  return utils;
}

const type = async (utils: ReturnType<typeof render>, text: string) => {
  await act(async () => {
    fireEvent.changeText(utils.getByTestId('email-code-input'), text);
  });
};

describe('SignInForm sent step, email code', () => {
  it('should offer the labelled code field with one-time-code hints', async () => {
    const { getByTestId, getByText } = await openSentStep();
    const input = getByTestId('email-code-input');
    expect(getByText('Or enter the 6-digit code from the email')).toBeTruthy();
    expect(input.props.keyboardType).toBe('number-pad');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.autoComplete).toBe('one-time-code');
  });

  it('should sign in as soon as 6 digits are typed', async () => {
    verify.mockResolvedValueOnce({ success: true, data: { status: 'already_activated' } });
    const utils = await openSentStep();
    await type(utils, '123456');
    expect(verify).toHaveBeenCalledWith('ana@example.pt', '123456');
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId('sign-in-done')).toBeTruthy();
  });

  it('should accept a pasted code with a space', async () => {
    verify.mockResolvedValueOnce({ success: true, data: { status: 'already_activated' } });
    const utils = await openSentStep();
    await type(utils, '123 456');
    expect(verify).toHaveBeenCalledWith('ana@example.pt', '123456');
  });

  it('should show an error when the code is wrong', async () => {
    verify.mockResolvedValueOnce({ success: false, incorrectCode: true });
    const utils = await openSentStep();
    await type(utils, '000000');
    expect(utils.getByTestId('email-code-error')).toBeTruthy();
    expect(utils.getByText('Incorrect code')).toBeTruthy();
    expect(mockRefreshAuth).not.toHaveBeenCalled();
  });

  it('should not call the server on Continue with fewer than 6 digits', async () => {
    const utils = await openSentStep();
    await type(utils, '123');
    await act(async () => {
      fireEvent.press(utils.getByTestId('email-code-submit'));
    });
    expect(verify).not.toHaveBeenCalled();
    expect(utils.getByTestId('email-code-error')).toBeTruthy();
  });

  it('should submit on Continue when 6 digits are present after an earlier failure', async () => {
    verify.mockResolvedValueOnce({ success: false, incorrectCode: true });
    verify.mockResolvedValueOnce({ success: true, data: { status: 'already_activated' } });
    const utils = await openSentStep();
    await type(utils, '111111');
    await act(async () => {
      fireEvent.press(utils.getByTestId('email-code-submit'));
    });
    expect(verify).toHaveBeenCalledTimes(2);
    expect(utils.getByTestId('sign-in-done')).toBeTruthy();
  });
});
