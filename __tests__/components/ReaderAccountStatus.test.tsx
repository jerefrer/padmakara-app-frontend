import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, within } from '@testing-library/react-native';

import { ReaderAccountStatus } from '@/components/membership/ReaderAccountStatus';
import MembershipScreen from '@/app/(tabs)/membership/index';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});

const mockPush = jest.fn();
let mockAuth: any;

jest.mock('expo-router', () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/services/membershipService', () => ({ membershipService: { get: jest.fn(), join: jest.fn() } }));

const original = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = 'ios';
  mockAuth = {
    isAuthenticated: true,
    hasActiveSubscription: true,
    isLoading: false,
    user: { name: 'Maria Silva', email: 'maria@example.pt' },
  };
});
afterAll(() => {
  (Platform as any).OS = original;
});

describe('ReaderAccountStatus (native)', () => {
  it('should show full access with name and email and no price or website link', () => {
    const { getByTestId, toJSON } = render(<ReaderAccountStatus />);
    expect(within(getByTestId('reader-row-access')).getByText('Full access')).toBeTruthy();
    const who = within(getByTestId('reader-row-who'));
    expect(who.getByText('Maria Silva')).toBeTruthy();
    expect(who.getByText('maria@example.pt')).toBeTruthy();
    const dump = JSON.stringify(toJSON());
    expect(dump).not.toContain('€');
    expect(dump).not.toContain('padmakara.pt');
  });

  it('should show public content only without access', () => {
    mockAuth.hasActiveSubscription = false;
    const { getByTestId } = render(<ReaderAccountStatus />);
    expect(within(getByTestId('reader-row-access')).getByText('Public content only')).toBeTruthy();
  });

  it('should offer only Sign in when signed out', () => {
    mockAuth = { isAuthenticated: false, hasActiveSubscription: false, isLoading: false, user: null };
    const { getByText, queryByText } = render(<ReaderAccountStatus />);
    fireEvent.press(getByText('Sign in'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/magic-link');
    expect(queryByText('Full access')).toBeNull();
  });
});

describe('/membership opened on native', () => {
  it('should render the reader status, never the join screen', () => {
    const { getByText, queryByText, toJSON } = render(<MembershipScreen />);
    expect(getByText('Full access')).toBeTruthy();
    expect(queryByText('Continue to payment')).toBeNull();
    expect(JSON.stringify(toJSON())).not.toContain('€');
  });
});
