import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { MembershipCard } from '@/components/membership/MembershipCard';

const mockPush = jest.fn();
let mockAuth: any;

jest.mock('expo-router', () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

const signedIn = (subscription: Record<string, unknown>, hasActiveSubscription = true) => ({
  hasActiveSubscription,
  user: { subscription: { status: 'active', source: 'easypay', expiresAt: '2026-11-07T00:00:00.000Z', cancelledAt: null, ...subscription } },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MembershipCard (status variant)', () => {
  it('should offer Manage membership and open /membership for a member paying through Easypay', () => {
    mockAuth = signedIn({});
    const { getByText } = render(<MembershipCard variant="status" />);
    expect(getByText('Active')).toBeTruthy();
    fireEvent.press(getByText('Manage membership'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it.each(['admin', 'cash', 'bank_transfer', null])(
    'should show the status and contact copy, with no manage link, for an active member whose source is %s',
    (source) => {
      mockAuth = signedIn({ source });
      const { getByText, queryByText } = render(<MembershipCard variant="status" />);
      expect(getByText('Active')).toBeTruthy();
      expect(getByText('Contact us to change your membership')).toBeTruthy();
      expect(queryByText('Manage membership')).toBeNull();
      expect(queryByText('Become a member')).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    },
  );

  it('should show when access ends for an admin-granted member whose end date is set and cancelled', () => {
    mockAuth = signedIn({ source: 'admin', cancelledAt: '2026-10-01T00:00:00.000Z' });
    const { getByText, queryByText } = render(<MembershipCard variant="status" />);
    expect(getByText(/^Ends /)).toBeTruthy();
    expect(queryByText('Manage membership')).toBeNull();
  });

  it('should still invite a lapsed admin-granted member to become a member', () => {
    mockAuth = signedIn({ source: 'admin' }, false);
    const { getByText, queryByText } = render(<MembershipCard variant="status" />);
    expect(getByText('No active membership')).toBeTruthy();
    expect(queryByText('Contact us to change your membership')).toBeNull();
    fireEvent.press(getByText('Become a member'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });
});
