import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { PasskeyInvite } from '@/components/auth/PasskeyInvite';
import { PasskeySignInButton } from '@/components/auth/PasskeySignInButton';
import apiService from '@/services/apiService';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

// The real web client and the real service: only the browser library and the network are faked.
jest.mock('@/services/passkeyClient', () => jest.requireActual('@/services/passkeyClient.web'));
jest.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: jest.fn(() => true),
  browserSupportsWebAuthnAutofill: jest.fn(() => Promise.resolve(false)),
  startAuthentication: jest.fn(),
  startRegistration: jest.fn(),
  WebAuthnAbortService: { cancelCeremony: jest.fn() },
}));
jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: { getDeviceInfo: jest.fn(), storeActivation: jest.fn() },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ refreshAuth: jest.fn(() => Promise.resolve()) }),
}));

const post = apiService.post as unknown as jest.Mock;
const authenticate = startAuthentication as unknown as jest.Mock;
const register = startRegistration as unknown as jest.Mock;

const originalOS = Platform.OS;
let challengeCounter = 0;
let postsWhenBrowserCalled: number | null = null;

function notAllowed() {
  const error = new Error('cancelled');
  error.name = 'NotAllowedError';
  return error;
}

const flush = () => act(async () => {});
const optionPosts = (endpoint: string) => post.mock.calls.filter(([url]) => String(url).includes(endpoint));

beforeEach(() => {
  Platform.OS = 'web';
  challengeCounter = 0;
  postsWhenBrowserCalled = null;
  post.mockReset();
  post.mockImplementation(async () => ({
    success: true,
    data: { challengeId: `c${++challengeCounter}`, options: { challenge: `abc${challengeCounter}` } },
  }));
  for (const fn of [authenticate, register]) {
    fn.mockReset();
    fn.mockImplementation(() => {
      postsWhenBrowserCalled = post.mock.calls.length;
      return Promise.reject(notAllowed());
    });
  }
  jest.requireMock('@simplewebauthn/browser').browserSupportsWebAuthn.mockReturnValue(true);
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe('PasskeySignInButton on the web', () => {
  it('should call startAuthentication without awaiting a network request inside the click handler when options are prefetched', async () => {
    render(<PasskeySignInButton />);
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
    // The next options request never answers: the browser call must not depend on it.
    post.mockImplementation(() => new Promise(() => {}));

    fireEvent.press(screen.getByTestId('passkey-sign-in'));

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ optionsJSON: { challenge: 'abc1' }, useBrowserAutofill: false }),
    );
    expect(postsWhenBrowserCalled).toBe(1);
    await flush();
  });

  it('should refetch options after an attempt', async () => {
    render(<PasskeySignInButton />);
    await flush();
    expect(optionPosts('login')).toHaveLength(1);

    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-sign-in'));
    });

    expect(optionPosts('login')).toHaveLength(2);
    // Each attempt uses a challenge once: the second press sends the new one.
    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-sign-in'));
    });
    expect(authenticate.mock.calls[1][0].optionsJSON).toEqual({ challenge: 'abc2' });
  });

  it('should fetch the options on press when none are ready', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      render(<PasskeySignInButton />);
      await flush();
      // Older than four minutes without the renewal having succeeded: not usable.
      post.mockImplementation(async () => ({ success: true, data: { challengeId: 'late', options: { challenge: 'late' } } }));
      jest.setSystemTime(Date.now() + 4 * 60 * 1000 + 1);
      await act(async () => {
        fireEvent.press(screen.getByTestId('passkey-sign-in'));
      });
      expect(authenticate.mock.calls[0][0].optionsJSON).toEqual({ challenge: 'late' });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('PasskeyInvite on the web', () => {
  it('should call startRegistration without awaiting a network request inside the click handler when options are prefetched', async () => {
    render(<PasskeyInvite userId="42" onContinue={jest.fn()} />);
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
    post.mockImplementation(() => new Promise(() => {}));

    fireEvent.press(screen.getByTestId('passkey-invite-accept'));

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({ optionsJSON: { challenge: 'abc1' } });
    expect(postsWhenBrowserCalled).toBe(1);
    await flush();
  });

  it('should refetch options after an attempt', async () => {
    render(<PasskeyInvite userId="42" onContinue={jest.fn()} />);
    await flush();
    expect(optionPosts('register')).toHaveLength(1);

    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-invite-accept'));
    });

    expect(optionPosts('register')).toHaveLength(2);
  });
});
