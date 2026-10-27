import React from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { SignInProvider, useSignIn } from '@/components/auth/SignInProvider';
import magicLinkService from '@/services/magicLinkService';

const mockPush = jest.fn();
let mockAuth: any;

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isMobile: false }) }));
jest.mock('@/services/magicLinkService', () => ({
  __esModule: true,
  default: { requestMagicLink: jest.fn(), checkActivationStatus: jest.fn(), reviewLogin: jest.fn() },
}));

const request = magicLinkService.requestMagicLink as jest.Mock;
const reviewLogin = magicLinkService.reviewLogin as jest.Mock;

function Opener() {
  const { openSignIn } = useSignIn();
  return (
    <Pressable testID="open" onPress={() => openSignIn({ returnTo: '/membership' })}>
      <Text>open</Text>
    </Pressable>
  );
}

const originalOS = Platform.OS;
beforeEach(() => {
  jest.resetAllMocks();
  mockAuth = { isAuthenticated: false, isDeviceActivated: false, refreshAuth: jest.fn() };
  (Platform as any).OS = 'web';
  (magicLinkService.checkActivationStatus as jest.Mock).mockResolvedValue({ success: true, data: { isActivated: false } });
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('SignInProvider', () => {
  it('should open sign-in over the current screen instead of navigating away', () => {
    const { getByTestId } = render(
      <SignInProvider>
        <Opener />
      </SignInProvider>,
    );
    fireEvent.press(getByTestId('open'));
    expect(getByTestId('sign-in-dialog')).toBeTruthy();
    expect(getByTestId('open')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should label the submit button Continue and hint at the emailed link when opened', () => {
    const { getByTestId, getByText } = render(
      <SignInProvider>
        <Opener />
      </SignInProvider>,
    );
    fireEvent.press(getByTestId('open'));
    expect(getByText('Continue')).toBeTruthy();
    expect(getByText("If this device isn't recognised, we'll email you a link.")).toBeTruthy();
  });

  it('should close when the close button is pressed', () => {
    const { getByTestId, queryByTestId } = render(
      <SignInProvider>
        <Opener />
      </SignInProvider>,
    );
    fireEvent.press(getByTestId('open'));
    fireEvent.press(getByTestId('sign-in-close'));
    expect(queryByTestId('sign-in-dialog')).toBeNull();
  });

  it('should close by itself once the person is signed in', () => {
    // A fresh element each time: re-rendering the same element object lets React skip the update.
    const tree = () => (
      <SignInProvider>
        <Opener />
      </SignInProvider>
    );
    const { getByTestId, queryByTestId, rerender } = render(tree());
    fireEvent.press(getByTestId('open'));
    mockAuth = { ...mockAuth, isAuthenticated: true, isDeviceActivated: true };
    rerender(tree());
    expect(queryByTestId('sign-in-dialog')).toBeNull();
  });

  it('should fall back to the full sign-in page outside the provider', () => {
    const { getByTestId } = render(<Opener />);
    fireEvent.press(getByTestId('open'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/magic-link', params: { returnTo: '/membership' } });
  });

  it('should show where the link went once it is sent', async () => {
    request.mockResolvedValueOnce({ success: true, data: { status: 'magic_link_sent' } });
    const { getByTestId, getByText } = render(
      <SignInProvider>
        <Opener />
      </SignInProvider>,
    );
    fireEvent.press(getByTestId('open'));
    fireEvent.changeText(getByTestId('sign-in-email'), 'ana@example.pt');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    await waitFor(() => expect(getByTestId('sign-in-sent')).toBeTruthy());
    expect(getByText('ana@example.pt')).toBeTruthy();
  });

  it('should send an unknown address to the access request page', async () => {
    request.mockResolvedValueOnce({ success: true, data: { status: 'approval_required' } });
    const { getByTestId, queryByTestId } = render(
      <SignInProvider>
        <Opener />
      </SignInProvider>,
    );
    fireEvent.press(getByTestId('open'));
    fireEvent.changeText(getByTestId('sign-in-email'), 'new@example.pt');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/magic-link',
      params: { email: 'new@example.pt', approval: '1' },
    });
    expect(queryByTestId('sign-in-dialog')).toBeNull();
  });

  describe('review code', () => {
    async function openAtCodeStep() {
      request.mockResolvedValueOnce({ success: true, data: { status: 'code_required' } });
      const utils = render(
        <SignInProvider>
          <Opener />
        </SignInProvider>,
      );
      fireEvent.press(utils.getByTestId('open'));
      fireEvent.changeText(utils.getByTestId('sign-in-email'), 'review@padmakara.pt');
      await act(async () => {
        fireEvent.press(utils.getByTestId('sign-in-submit'));
      });
      return utils;
    }

    it('should show the code field with its help text when the server asks for a code', async () => {
      const { getByTestId, getByText } = await openAtCodeStep();
      expect(getByTestId('review-code-input')).toBeTruthy();
      expect(getByTestId('review-code-submit')).toBeTruthy();
      expect(getByText('This account signs in with a code provided to app reviewers.')).toBeTruthy();
    });

    it('should sign in and finish like an activated device when the code is right', async () => {
      const { getByTestId } = await openAtCodeStep();
      reviewLogin.mockResolvedValueOnce({ success: true, data: { status: 'already_activated' } });
      fireEvent.changeText(getByTestId('review-code-input'), 'demo-code-1');
      await act(async () => {
        fireEvent.press(getByTestId('review-code-submit'));
      });
      expect(reviewLogin).toHaveBeenCalledWith('review@padmakara.pt', 'demo-code-1');
      expect(mockAuth.refreshAuth).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(getByTestId('sign-in-done')).toBeTruthy());
    });

    it('should show an error when the code is wrong', async () => {
      const { getByTestId, getByText } = await openAtCodeStep();
      reviewLogin.mockResolvedValueOnce({ success: false, incorrectCode: true });
      fireEvent.changeText(getByTestId('review-code-input'), 'wrong-code');
      await act(async () => {
        fireEvent.press(getByTestId('review-code-submit'));
      });
      expect(getByText('Incorrect code')).toBeTruthy();
      expect(mockAuth.refreshAuth).not.toHaveBeenCalled();
    });
  });
});
