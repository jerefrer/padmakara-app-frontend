import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { SettingsList, SettingsTwoPane } from '@/components/settings/SettingsLayouts';

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
// The section bodies have their own services; these tests are about the index around them.
jest.mock('@/components/settings/SectionBody', () => {
  const { Text } = require('react-native');
  return {
    SECTIONS_WITH_OWN_TITLE: new Set(['membership']),
    SectionBody: ({ id }: { id: string }) => <Text>{`body:${id}`}</Text>,
  };
});

const member = {
  isAuthenticated: true,
  hasActiveSubscription: true,
  user: {
    name: 'Maria Silva',
    email: 'maria@example.pt',
    subscription: { status: 'active', expiresAt: '2026-11-01T00:00:00.000Z', cancelledAt: null },
  },
};
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = member;
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('SettingsList', () => {
  it('should show the membership row with its state on the web', () => {
    (Platform as any).OS = 'web';
    const { getByTestId } = render(<SettingsList />);
    expect(getByTestId('settings-row-membership')).toBeTruthy();
    expect(getByTestId('settings-row-membership').props.accessibilityLabel).toBe('Membership, Active');
  });

  it('should open the membership page itself from its row', () => {
    (Platform as any).OS = 'web';
    const { getByTestId } = render(<SettingsList />);
    fireEvent.press(getByTestId('settings-row-membership'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it('should invite to join when there is no membership', () => {
    (Platform as any).OS = 'web';
    mockAuth = { ...member, hasActiveSubscription: false };
    const { getByTestId } = render(<SettingsList />);
    expect(getByTestId('settings-row-membership').props.accessibilityLabel).toBe('Become a member');
  });

  it('should not show any membership row in the native app', () => {
    (Platform as any).OS = 'ios';
    const { queryByTestId, queryByText } = render(<SettingsList />);
    expect(queryByTestId('settings-row-membership')).toBeNull();
    expect(queryByText(/member/i)).toBeNull();
  });

  it('should still show the access to retreats in the native app', () => {
    (Platform as any).OS = 'ios';
    const { getByTestId } = render(<SettingsList />);
    expect(getByTestId('settings-row-retreats').props.accessibilityLabel).toBe('Your retreats, Full access');
  });

  it('should open a section on its own page', () => {
    (Platform as any).OS = 'ios';
    const { getByTestId } = render(<SettingsList />);
    fireEvent.press(getByTestId('settings-row-storage'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/storage');
  });

  it('should name the device group after where it applies', () => {
    (Platform as any).OS = 'web';
    expect(render(<SettingsList />).getByText('This browser')).toBeTruthy();
    (Platform as any).OS = 'ios';
    expect(render(<SettingsList />).getByText('This device')).toBeTruthy();
  });

  it('should offer to sign in, with only the settings that work signed out', () => {
    (Platform as any).OS = 'web';
    mockAuth = { isAuthenticated: false, hasActiveSubscription: false, user: null };
    const { getByTestId, queryByTestId } = render(<SettingsList />);
    expect(getByTestId('settings-sign-in')).toBeTruthy();
    expect(queryByTestId('settings-row-profile')).toBeNull();
    expect(queryByTestId('settings-row-membership')).toBeNull();
    expect(getByTestId('settings-row-language')).toBeTruthy();
  });
});

describe('SettingsTwoPane', () => {
  beforeEach(() => {
    (Platform as any).OS = 'web';
  });

  it('should show the selected section beside the index, under its title', () => {
    const { getByTestId, getByText } = render(<SettingsTwoPane selected="language" onSelect={jest.fn()} />);
    expect(getByTestId('settings-pane-language')).toBeTruthy();
    expect(getByText('body:language')).toBeTruthy();
    expect(getByTestId('settings-nav-language').props.accessibilityState).toEqual({ selected: true });
  });

  it('should report the section chosen in the index', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<SettingsTwoPane selected="profile" onSelect={onSelect} />);
    fireEvent.press(getByTestId('settings-nav-membership'));
    expect(onSelect).toHaveBeenCalledWith('membership');
  });
});
