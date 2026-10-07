import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { JoinMembership } from '@/components/membership/JoinMembership';
import { membershipService } from '@/services/membershipService';

const mockPush = jest.fn();
let mockAuthed = true;

jest.mock('expo-router', () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: mockAuthed }) }));
jest.mock('@/services/membershipService', () => ({
  membershipService: { join: jest.fn() },
}));

const join = membershipService.join as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthed = true;
});

describe('JoinMembership', () => {
  it('should default to 10 euros monthly with the plain summary', () => {
    const { getByText } = render(<JoinMembership />);
    expect(getByText('€10 every month')).toBeTruthy();
    expect(getByText('Renews automatically. Cancel anytime from your account.')).toBeTruthy();
  });

  it('should show the yearly chips and summary when Yearly is pressed', () => {
    const { getByText } = render(<JoinMembership />);
    fireEvent.press(getByText('Yearly'));
    expect(getByText('€60')).toBeTruthy();
    expect(getByText('€120')).toBeTruthy();
    expect(getByText('€240')).toBeTruthy();
    expect(getByText('€120 every year')).toBeTruthy();
  });

  it('should disable continue and show the minimum message when Other is below the minimum', () => {
    const { getByText, getByLabelText } = render(<JoinMembership />);
    fireEvent.press(getByText('Other'));
    expect(getByText('per month · minimum €5')).toBeTruthy();
    fireEvent.changeText(getByLabelText('Amount'), '4');
    expect(getByText(/at least €5/)).toBeTruthy();
    fireEvent.press(getByText('Continue to payment'));
    expect(join).not.toHaveBeenCalled();
  });

  it('should call join with 10, month and the language when continue is pressed', async () => {
    join.mockResolvedValue({ success: true, data: { url: 'https://pay.example/x' } });
    const onJoined = jest.fn();
    const { getByText } = render(<JoinMembership onJoined={onJoined} />);
    fireEvent.press(getByText('Continue to payment'));
    await waitFor(() => expect(join).toHaveBeenCalledWith(10, 'month', 'en'));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('https://pay.example/x'));
  });

  it('should show the localized range message on INVALID_CONTRIBUTION', async () => {
    join.mockResolvedValue({ success: false, error: 'raw api text', code: 'INVALID_CONTRIBUTION' });
    const { getByText, queryByText } = render(<JoinMembership />);
    fireEvent.press(getByText('Continue to payment'));
    await waitFor(() => expect(getByText('The amount must be between €5 and €1000.')).toBeTruthy());
    expect(queryByText('raw api text')).toBeNull();
  });

  it('should show a localized generic error, never the raw server text, for other failures', async () => {
    join.mockResolvedValue({ success: false, error: 'You already have an active subscription' });
    const { getByText, queryByText } = render(<JoinMembership />);
    fireEvent.press(getByText('Continue to payment'));
    await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
    expect(queryByText(/subscription/)).toBeNull();
  });

  it('should show the failed-payment banner only when lastPaymentFailedAt is set', () => {
    const text =
      "Your last payment didn't go through. Nothing was charged. You can try again with another card or bank account.";
    const withBanner = render(<JoinMembership lastPaymentFailedAt="2026-10-06T10:00:00.000Z" />);
    expect(withBanner.getByText(text)).toBeTruthy();
    const without = render(<JoinMembership lastPaymentFailedAt={null} />);
    expect(without.queryByText(text)).toBeNull();
  });

  it('should show the localized processing message on MEMBERSHIP_PROCESSING', async () => {
    join.mockResolvedValue({ success: false, error: 'raw', code: 'MEMBERSHIP_PROCESSING' });
    const { getByText } = render(<JoinMembership />);
    fireEvent.press(getByText('Continue to payment'));
    await waitFor(() => expect(getByText('Your first payment is still being processed.')).toBeTruthy());
  });

  it('should route a signed-out visitor to the magic link with returnTo', () => {
    mockAuthed = false;
    const { getByText } = render(<JoinMembership />);
    fireEvent.press(getByText('Continue to payment'));
    expect(join).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/magic-link',
      params: { returnTo: '/membership' },
    });
  });
});
