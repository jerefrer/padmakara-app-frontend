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
  default: { requestMagicLink: jest.fn(), checkActivationStatus: jest.fn() },
}));

const request = magicLinkService.requestMagicLink as jest.Mock;

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
});
