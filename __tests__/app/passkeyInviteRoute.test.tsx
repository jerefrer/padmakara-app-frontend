import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PasskeyInviteScreen from '@/app/(auth)/passkey-invite';
import { armInvite, disarmInvite } from '@/hooks/passkeyInviteState';

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({
  router: { replace: (...a: any[]) => mockReplace(...a), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: () => undefined }) }));
let mockUser: { id: string } | null = { id: '42' };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/services/passkeyService', () => ({ registerPasskey: jest.fn(), isPasskeySupported: jest.fn() }));

async function leave(next: string) {
  mockParams = { next };
  mockReplace.mockClear();
  armInvite();
  const view = render(<PasskeyInviteScreen />);
  await act(async () => {
    fireEvent.press(screen.getByTestId('passkey-invite-later'));
  });
  view.unmount();
}

beforeEach(() => {
  mockUser = { id: '42' };
  disarmInvite();
});

describe('passkey invite route', () => {
  it('should continue to a safe internal path', async () => {
    await leave('/(tabs)/search');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/search');
  });

  it.each(['//evil.com', 'https://evil.com', 'javascript:alert(1)'])(
    'should fall back to home for next=%s',
    async (next) => {
      await leave(next);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    },
  );

  it('should show the invitation when a trigger just opened it', () => {
    mockParams = {};
    mockReplace.mockClear();
    armInvite();
    render(<PasskeyInviteScreen />);

    expect(screen.getByTestId('passkey-invite-later')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('should go home instead of showing the invitation again on reload or Back', () => {
    mockParams = {};
    mockReplace.mockClear();
    render(<PasskeyInviteScreen />);

    expect(screen.queryByTestId('passkey-invite-later')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('should go home when there is no signed-in user', () => {
    mockUser = null;
    mockParams = {};
    mockReplace.mockClear();
    armInvite();
    render(<PasskeyInviteScreen />);

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
