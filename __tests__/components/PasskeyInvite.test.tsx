import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PasskeyInvite } from '@/components/auth/PasskeyInvite';
import { SignInForm } from '@/components/auth/SignInForm';
import { registerPasskey, isPasskeySupported } from '@/services/passkeyService';

const mockRefreshAuth = jest.fn(() => Promise.resolve());
const mockPush = jest.fn();
let mockUser: any = { id: '42' };

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text testID={`icon-${props.name}`}>{props.color}</Text> };
});
jest.mock('expo-router', () => {
  const R = require('react');
  return {
    router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]),
  };
});
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ refreshAuth: mockRefreshAuth, user: mockUser }),
}));
jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: { requestMagicLink: jest.fn(), checkActivationStatus: jest.fn(), reviewLogin: jest.fn(), verifyEmailCode: jest.fn() },
}));
jest.mock('@/services/passkeyService', () => ({
  isPasskeySupported: jest.fn(),
  supportsPasskeyAutofill: jest.fn(),
  signInWithPasskey: jest.fn(),
  registerPasskey: jest.fn(),
  tryListPasskeys: jest.fn(),
}));

const register = registerPasskey as jest.Mock;
const supported = isPasskeySupported as jest.Mock;
const magicLink = jest.requireMock('@/services/magicLinkService').default;

beforeEach(() => {
  // Not resetAllMocks: it would also wipe the AsyncStorage mock's implementations.
  for (const fn of [mockPush, register, supported, mockRefreshAuth, ...Object.values<jest.Mock>(magicLink)]) fn.mockReset();
  const svc = jest.requireMock('@/services/passkeyService');
  svc.supportsPasskeyAutofill.mockReset().mockResolvedValue(false);
  svc.signInWithPasskey.mockReset();
  mockRefreshAuth.mockResolvedValue(undefined as never);
  mockUser = { id: '42' };
  supported.mockResolvedValue(true);
});

describe('PasskeyInvite', () => {
  it('should continue to next after Not now', async () => {
    const onContinue = jest.fn();
    render(<PasskeyInvite userId="42" onContinue={onContinue} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-invite-later'));
    });

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(register).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('passkeyInvite:42')).not.toBeNull();
  });

  it('should remember the invitation as soon as it is shown', async () => {
    render(<PasskeyInvite userId="42" onContinue={jest.fn()} />);
    await act(async () => {});

    expect(await AsyncStorage.getItem('passkeyInvite:42')).not.toBeNull();
  });

  it('should show the confirmation then continue after success', async () => {
    jest.useFakeTimers();
    register.mockResolvedValue({ ok: true });
    const onContinue = jest.fn();
    render(<PasskeyInvite userId="42" onContinue={onContinue} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-invite-accept'));
    });

    expect(screen.getByTestId('passkey-invite-success')).toBeTruthy();
    expect(onContinue).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('should treat a cancelled system sheet like Not now with the quiet Settings hint', async () => {
    jest.useFakeTimers();
    register.mockResolvedValue({ ok: false, cancelled: true });
    const onContinue = jest.fn();
    render(<PasskeyInvite userId="42" onContinue={onContinue} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-invite-accept'));
    });

    expect(screen.getByText('You can set it up later in Settings.')).toBeTruthy();
    expect(screen.queryByTestId('passkey-error')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('should treat a failure like a cancel, without an error', async () => {
    jest.useFakeTimers();
    register.mockResolvedValue({ ok: false, cancelled: false });
    const onContinue = jest.fn();
    render(<PasskeyInvite userId="42" onContinue={onContinue} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-invite-accept'));
    });

    expect(screen.getByText('You can set it up later in Settings.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('invitation after sign-in (SignInForm)', () => {
  const flush = () => act(async () => {});

  async function submitEmail() {
    const utils = render(<SignInForm />);
    await flush();
    fireEvent.changeText(utils.getByTestId('sign-in-email'), 'ana@example.pt');
    await act(async () => {
      fireEvent.press(utils.getByTestId('sign-in-submit'));
    });
    await flush();
    return utils;
  }

  it('should send the person to the invitation once an email sign-in completes', async () => {
    magicLink.requestMagicLink.mockResolvedValue({ success: true, data: { status: 'already_activated' } });
    supported.mockResolvedValue(true);

    await submitEmail();

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/passkey-invite' });
  });

  it('should not invite after a passkey sign-in', async () => {
    jest.requireMock('@/services/passkeyService').supportsPasskeyAutofill.mockResolvedValue(true);
    jest.requireMock('@/services/passkeyService').signInWithPasskey.mockResolvedValue({ ok: true });

    const { getByTestId } = render(<SignInForm />);
    await flush();
    await flush();

    expect(getByTestId('sign-in-done')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should not invite when passkeys are unsupported', async () => {
    magicLink.requestMagicLink.mockResolvedValue({ success: true, data: { status: 'already_activated' } });
    supported.mockResolvedValue(false);

    await submitEmail();

    expect(mockPush).not.toHaveBeenCalled();
  });
});
