import React from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SignInProvider, useSignIn } from '@/components/auth/SignInProvider';
import { clearEmailSignInMarker, markEmailSignIn } from '@/hooks/passkeyInviteState';
import magicLinkService from '@/services/magicLinkService';
import { isPasskeySupported } from '@/services/passkeyService';

const mockPush = jest.fn();
const mockSubs = new Set<() => void>();
let mockAuth: any;

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({
  router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
// A live auth mock: flipping it re-renders every consumer, like the real provider does.
jest.mock('@/contexts/AuthContext', () => {
  const R = require('react');
  return {
    useAuth: () => {
      const [, force] = R.useState(0);
      R.useEffect(() => {
        const sub = () => force((n: number) => n + 1);
        mockSubs.add(sub);
        return () => {
          mockSubs.delete(sub);
        };
      }, []);
      return mockAuth;
    },
  };
});
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isMobile: false }) }));
jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: { requestMagicLink: jest.fn(), checkActivationStatus: jest.fn(), reviewLogin: jest.fn(), verifyEmailCode: jest.fn() },
}));
jest.mock('@/services/passkeyService', () => ({
  isPasskeySupported: jest.fn(),
  supportsPasskeyAutofill: jest.fn().mockResolvedValue(false),
  signInWithPasskey: jest.fn(),
}));

function signInNow(extra: object = {}) {
  mockAuth = { ...mockAuth, isAuthenticated: true, isDeviceActivated: true, user: { id: '42' }, ...extra };
  mockSubs.forEach((s) => s());
}

function Opener() {
  const { openSignIn } = useSignIn();
  return (
    <Pressable testID="open" onPress={() => openSignIn()}>
      <Text>open</Text>
    </Pressable>
  );
}

const originalOS = Platform.OS;
beforeEach(async () => {
  jest.useFakeTimers();
  mockPush.mockReset();
  clearEmailSignInMarker();
  await AsyncStorage.clear();
  (isPasskeySupported as jest.Mock).mockResolvedValue(true);
  (magicLinkService.checkActivationStatus as jest.Mock).mockResolvedValue({ success: true, data: { isActivated: false } });
  (magicLinkService.requestMagicLink as jest.Mock).mockResolvedValue({ success: true, data: { status: 'already_activated' } });
  mockAuth = { isAuthenticated: false, isDeviceActivated: false, user: null, refreshAuth: jest.fn() };
  (Platform as any).OS = 'web';
});
afterEach(() => {
  jest.useRealTimers();
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

const invitePushes = () => mockPush.mock.calls.filter(([a]) => a?.pathname === '/(auth)/passkey-invite');

describe('passkey invitation after an email sign-in', () => {
  it('should invite once even when the sign-in form unmounts before refreshAuth resolves', async () => {
    // The real refreshAuth flips isAuthenticated first; the sheet then closes and the form unmounts.
    mockAuth.refreshAuth = jest.fn(async () => {
      signInNow();
      await Promise.resolve();
    });
    const { getByTestId, queryByTestId } = render(
      <SignInProvider>
        <Opener />
      </SignInProvider>,
    );
    fireEvent.press(getByTestId('open'));
    fireEvent.changeText(getByTestId('sign-in-email'), 'ana@example.pt');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    expect(queryByTestId('sign-in-dialog')).toBeNull();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(invitePushes()).toHaveLength(1);
  });

  it('should not invite after a sign-in that did not go through email (passkey)', async () => {
    render(
      <SignInProvider>
        <Opener />
      </SignInProvider>,
    );
    await act(async () => {
      signInNow();
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(invitePushes()).toHaveLength(0);
  });

  it('should not invite when the email sign-in marker was cleared by a passkey sign-in', async () => {
    render(
      <SignInProvider>
        <Opener />
      </SignInProvider>,
    );
    markEmailSignIn();
    clearEmailSignInMarker();
    await act(async () => {
      signInNow();
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(invitePushes()).toHaveLength(0);
  });
});
