import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { PasskeySignInButton } from '@/components/auth/PasskeySignInButton';
import { SignInForm } from '@/components/auth/SignInForm';
import { isPasskeySupported, signInWithPasskey, supportsPasskeyAutofill } from '@/services/passkeyService';

const mockRefreshAuth = jest.fn(() => Promise.resolve());

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text testID={`icon-${props.name}`}>{props.color}</Text> };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
let mockFreshIdentity = false;
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ refreshAuth: mockFreshIdentity ? () => mockRefreshAuth() : mockRefreshAuth }),
}));
jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: { requestMagicLink: jest.fn(), checkActivationStatus: jest.fn(), reviewLogin: jest.fn(), verifyEmailCode: jest.fn() },
}));
jest.mock('@/services/passkeyService', () => ({
  isPasskeySupported: jest.fn(),
  supportsPasskeyAutofill: jest.fn(),
  signInWithPasskey: jest.fn(),
}));

const supported = isPasskeySupported as jest.Mock;
const autofillSupported = supportsPasskeyAutofill as jest.Mock;
const signIn = signInWithPasskey as jest.Mock;
const magicLink = jest.requireMock('@/services/magicLinkService').default;

beforeEach(() => {
  jest.resetAllMocks();
  mockFreshIdentity = false;
  mockRefreshAuth.mockResolvedValue(undefined as never);
  supported.mockResolvedValue(true);
  autofillSupported.mockResolvedValue(false);
  magicLink.checkActivationStatus.mockResolvedValue({ success: true, data: { isActivated: false } });
});

const flush = () => act(async () => {});

describe('PasskeySignInButton', () => {
  it('should hide the button when passkeys are unsupported', async () => {
    supported.mockResolvedValue(false);
    const { queryByTestId } = render(<PasskeySignInButton />);
    await flush();
    expect(queryByTestId('passkey-sign-in')).toBeNull();
  });

  it('should sign in and call onSignedIn when the passkey works', async () => {
    signIn.mockResolvedValue({ ok: true });
    const onSignedIn = jest.fn();
    const { getByTestId } = render(<PasskeySignInButton onSignedIn={onSignedIn} />);
    await flush();
    await act(async () => {
      fireEvent.press(getByTestId('passkey-sign-in'));
    });
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('should show nothing when the person cancels', async () => {
    signIn.mockResolvedValue({ ok: false, cancelled: true });
    const onSignedIn = jest.fn();
    const { getByTestId, queryByTestId } = render(<PasskeySignInButton onSignedIn={onSignedIn} />);
    await flush();
    await act(async () => {
      fireEvent.press(getByTestId('passkey-sign-in'));
    });
    expect(queryByTestId('passkey-error')).toBeNull();
    expect(getByTestId('passkey-sign-in')).toBeTruthy();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('should show a quiet line and keep the button when sign-in fails', async () => {
    signIn.mockResolvedValue({ ok: false, cancelled: false });
    const { getByTestId, getByText } = render(<PasskeySignInButton />);
    await flush();
    await act(async () => {
      fireEvent.press(getByTestId('passkey-sign-in'));
    });
    expect(getByText("That didn't work. You can use your email instead.")).toBeTruthy();
    expect(getByTestId('passkey-sign-in')).toBeTruthy();
  });
});

describe('SignInForm passkey autofill', () => {
  it('should abort the autofill request when the email form is submitted', async () => {
    autofillSupported.mockResolvedValue(true);
    let signal: AbortSignal | undefined;
    signIn.mockImplementation((opts: { signal?: AbortSignal }) => {
      signal = opts.signal;
      return new Promise(() => {});
    });
    magicLink.requestMagicLink.mockResolvedValue({ success: true, data: { status: 'magic_link_sent' } });
    const { getByTestId } = render(<SignInForm />);
    await flush();
    expect(signIn).toHaveBeenCalledWith(expect.objectContaining({ autofill: true }));
    expect(signal?.aborted).toBe(false);
    fireEvent.changeText(getByTestId('sign-in-email'), 'ana@example.pt');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    expect(signal?.aborted).toBe(true);
  });

  it('should abort the autofill request on unmount and ignore its late result', async () => {
    autofillSupported.mockResolvedValue(true);
    let signal: AbortSignal | undefined;
    let resolve: (v: unknown) => void = () => {};
    signIn.mockImplementation((opts: { signal?: AbortSignal }) => {
      signal = opts.signal;
      return new Promise((r) => (resolve = r));
    });
    const { unmount } = render(<SignInForm />);
    await flush();
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve({ ok: true }));
    expect(mockRefreshAuth).not.toHaveBeenCalled();
  });

  it('should sign in when autofill succeeds', async () => {
    autofillSupported.mockResolvedValue(true);
    signIn.mockResolvedValue({ ok: true });
    const { getByTestId } = render(<SignInForm />);
    await flush();
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(getByTestId('sign-in-done')).toBeTruthy();
  });

  it('should keep the autofill request alive when refreshAuth changes identity between renders', async () => {
    mockFreshIdentity = true;
    autofillSupported.mockResolvedValue(true);
    let signal: AbortSignal | undefined;
    let resolve: (v: unknown) => void = () => {};
    signIn.mockImplementation((opts: { signal?: AbortSignal }) => {
      signal = opts.signal;
      return new Promise((r) => (resolve = r));
    });
    const { getByTestId, rerender } = render(<SignInForm />);
    await flush();
    rerender(<SignInForm />);
    rerender(<SignInForm />);
    await flush();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signal?.aborted).toBe(false);
    await act(async () => resolve({ ok: true }));
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(getByTestId('sign-in-done')).toBeTruthy();
  });

  it('should stay silent and not retry when autofill fails', async () => {
    autofillSupported.mockResolvedValue(true);
    signIn.mockResolvedValue({ ok: false, cancelled: false });
    const { queryByText } = render(<SignInForm />);
    await flush();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(queryByText("That didn't work. You can use your email instead.")).toBeNull();
  });

  it('should not start autofill when it is unsupported', async () => {
    render(<SignInForm />);
    await flush();
    expect(signIn).not.toHaveBeenCalled();
  });
});
