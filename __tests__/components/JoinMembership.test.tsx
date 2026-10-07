import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { JoinMembership } from '@/components/membership/JoinMembership';
import { membershipService } from '@/services/membershipService';
import { colors } from '@/constants/colors';

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

  describe('Other amount', () => {
    it('should show the neutral helper, no error and a disabled button right after pressing Other', () => {
      const { getByText, queryByText, getByLabelText } = render(<JoinMembership />);
      fireEvent.press(getByText('Other'));
      expect(getByText('per month · minimum €5')).toBeTruthy();
      expect(queryByText('Enter an amount.')).toBeNull();
      expect(getByLabelText('Amount').props.value).toBe('');
      fireEvent.press(getByText('Continue to payment'));
      expect(join).not.toHaveBeenCalled();
    });

    it('should show the error after typing a value below the minimum', () => {
      const { getByText, getByLabelText } = render(<JoinMembership />);
      fireEvent.press(getByText('Other'));
      fireEvent.changeText(getByLabelText('Amount'), '3');
      expect(getByText(/at least €5/)).toBeTruthy();
    });

    it('should accept 12, clear the error and enable continue with the summary', async () => {
      join.mockResolvedValue({ success: true, data: { url: 'https://pay.example/x' } });
      const { getByText, queryByText, getByLabelText } = render(<JoinMembership />);
      fireEvent.press(getByText('Other'));
      fireEvent.changeText(getByLabelText('Amount'), '3');
      fireEvent.changeText(getByLabelText('Amount'), '12');
      expect(queryByText(/at least/)).toBeNull();
      expect(getByText('€12 every month')).toBeTruthy();
      fireEvent.press(getByText('Continue to payment'));
      await waitFor(() => expect(join).toHaveBeenCalledWith(12, 'month', 'en'));
    });

    it('should show the error when the field is left empty after being touched', () => {
      const { getByText, getByLabelText } = render(<JoinMembership />);
      fireEvent.press(getByText('Other'));
      fireEvent(getByLabelText('Amount'), 'blur');
      expect(getByText('Enter an amount.')).toBeTruthy();
    });

    it('should start empty and untouched again after switching to a chip and back to Other', () => {
      const { getByText, queryByText, getByLabelText } = render(<JoinMembership />);
      fireEvent.press(getByText('Other'));
      fireEvent.changeText(getByLabelText('Amount'), '3');
      expect(getByText(/at least €5/)).toBeTruthy();
      fireEvent.press(getByText('€5'));
      fireEvent.press(getByText('Other'));
      expect(getByLabelText('Amount').props.value).toBe('');
      expect(queryByText(/at least/)).toBeNull();
      expect(queryByText('Enter an amount.')).toBeNull();
    });

    it('should use a muted placeholder colour', () => {
      const { getByText, getByLabelText } = render(<JoinMembership />);
      fireEvent.press(getByText('Other'));
      expect(getByLabelText('Amount').props.placeholderTextColor).toBe(colors.gray[400]);
    });

    it('should render the euro symbol after the input, not before', () => {
      const { getByText, getByLabelText, toJSON } = render(<JoinMembership />);
      fireEvent.press(getByText('Other'));
      const json = JSON.stringify(toJSON());
      const inputAt = json.indexOf('"accessibilityLabel":"Amount"');
      const euroAt = json.indexOf('"€"');
      expect(inputAt).toBeGreaterThan(-1);
      expect(euroAt).toBeGreaterThan(inputAt);
      expect(getByLabelText('Amount')).toBeTruthy();
    });
  });

  describe('focus ring on web', () => {
    const originalOS = Platform.OS;
    beforeEach(() => {
      (Platform as any).OS = 'web';
    });
    afterAll(() => {
      (Platform as any).OS = originalOS;
    });

    const flat = (node: any) => StyleSheet.flatten(node.props.style);

    it('should hide the browser outline on a chip after a mouse focus', () => {
      const { getByText } = render(<JoinMembership />);
      const chip = getByText('€5').parent!.parent!;
      fireEvent(chip, 'focus', { target: { matches: () => false } });
      expect(flat(getByText('€5').parent!.parent!).outlineStyle).toBe('none');
    });

    it('should show a burgundy outline on a chip after a keyboard focus', () => {
      const { getByText } = render(<JoinMembership />);
      fireEvent(getByText('€5').parent!.parent!, 'focus', { target: { matches: () => true } });
      const style = flat(getByText('€5').parent!.parent!);
      expect(style.outlineStyle).toBe('solid');
      expect(style.outlineColor).toBe(colors.burgundy[500]);
    });

    it('should do the same for the Monthly and Yearly toggle', () => {
      const { getByText } = render(<JoinMembership />);
      expect(flat(getByText('Yearly').parent!.parent!).outlineStyle).toBe('none');
      fireEvent(getByText('Yearly').parent!.parent!, 'focus', { target: { matches: () => true } });
      expect(flat(getByText('Yearly').parent!.parent!).outlineColor).toBe(colors.burgundy[500]);
    });
  });
});
