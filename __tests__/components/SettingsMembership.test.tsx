import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';

import { SettingsMembership } from '@/components/membership/SettingsMembership';

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

const sub = (over: Record<string, unknown> = {}) => ({
  status: 'active',
  source: 'easypay',
  expiresAt: '2026-11-07T00:00:00.000Z',
  cancelledAt: null,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('SettingsMembership', () => {
  it('should render exactly one membership row labelled Membership with the Active value', () => {
    mockAuth = { hasActiveSubscription: true, user: { subscription: sub() } };
    const { getAllByTestId, getAllByText } = render(<SettingsMembership />);
    const rows = getAllByTestId('settings-membership-row');
    expect(rows).toHaveLength(1);
    expect(getAllByText('Membership')).toHaveLength(2); // the section label and the row
    expect(within(rows[0]).getByText('Membership')).toBeTruthy();
    expect(within(rows[0]).getByText('Active')).toBeTruthy();
  });

  it('should open /membership when the row is pressed', () => {
    mockAuth = { hasActiveSubscription: true, user: { subscription: sub() } };
    const { getByTestId } = render(<SettingsMembership />);
    fireEvent.press(getByTestId('settings-membership-row'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it('should show the end date for a cancelled member', () => {
    mockAuth = { hasActiveSubscription: true, user: { subscription: sub({ cancelledAt: '2026-10-01T00:00:00.000Z' }) } };
    const { getByText } = render(<SettingsMembership />);
    expect(getByText('Ends 7 November 2026')).toBeTruthy();
  });

  it('should offer Become a member with the none status for a non-member', () => {
    mockAuth = { hasActiveSubscription: false, user: { subscription: null } };
    const { getAllByTestId } = render(<SettingsMembership />);
    const rows = getAllByTestId('settings-membership-row');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('Become a member')).toBeTruthy();
    expect(within(rows[0]).getByText('No active membership')).toBeTruthy();
    expect(within(rows[0]).queryByText('Membership')).toBeNull();
  });

  it('should show Active and still lead to /membership for an admin-granted member', () => {
    mockAuth = { hasActiveSubscription: true, user: { subscription: sub({ source: 'admin' }) } };
    const { getByText, getByTestId } = render(<SettingsMembership />);
    expect(getByText('Active')).toBeTruthy();
    fireEvent.press(getByTestId('settings-membership-row'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });
});
