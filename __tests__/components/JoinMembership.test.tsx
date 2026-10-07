import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { JoinMembership } from '@/components/membership/JoinMembership';
import { membershipService } from '@/services/membershipService';
import { colors } from '@/constants/colors';
import { space } from '@/components/membership/pageStyles';

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
const manifestData = { checkout: { id: 'chk-1', session: 'sess 1/x' }, testing: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthed = true;
});

describe('JoinMembership', () => {
  it('should render the monthly radio rows with their interval-specific labels', () => {
    const { getByText, getByTestId } = render(<JoinMembership />);
    expect(getByText('€5 a month')).toBeTruthy();
    expect(getByText('€10 a month')).toBeTruthy();
    expect(getByText('€20 a month')).toBeTruthy();
    expect(getByText('Another amount')).toBeTruthy();
    expect(getByTestId('amount-row-10').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('amount-row-5').props.accessibilityState.checked).toBe(false);
  });

  it('should mark the active interval tab as selected', () => {
    const { getByTestId } = render(<JoinMembership />);
    expect(getByTestId('interval-tab-month').props.accessibilityState.selected).toBe(true);
    fireEvent.press(getByTestId('interval-tab-year'));
    expect(getByTestId('interval-tab-year').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('interval-tab-month').props.accessibilityState.selected).toBe(false);
  });

  it('should select a row and update the summary when a suggested row is pressed', () => {
    const { getByTestId, getByText } = render(<JoinMembership />);
    fireEvent.press(getByTestId('amount-row-20'));
    expect(getByText('€20 every month.')).toBeTruthy();
    expect(getByTestId('amount-row-20').props.accessibilityState.checked).toBe(true);
  });

  it('should show the section label for the contribution', () => {
    const { getByText } = render(<JoinMembership />);
    expect(getByText('Your contribution')).toBeTruthy();
  });

  it('should disable the button while Another amount is chosen and invalid', () => {
    const { getByTestId, getByText } = render(<JoinMembership />);
    fireEvent.press(getByTestId('amount-row-other'));
    expect(getByText('Continue to payment').parent!.parent!.props.accessibilityState.disabled).toBe(true);
  });

  it('should not show a red error when the empty amount field loses focus', () => {
    // Clicking elsewhere without typing is not a mistake: only the grey helper shows,
    // and the disabled button says the rest. Red is for a typed value that is invalid.
    const { getByTestId, getByLabelText, queryByText } = render(<JoinMembership />);
    fireEvent.press(getByTestId('amount-row-other'));
    fireEvent(getByLabelText('Amount'), 'blur');
    expect(queryByText('Enter an amount.')).toBeNull();
    fireEvent.changeText(getByLabelText('Amount'), '   ');
    fireEvent(getByLabelText('Amount'), 'blur');
    expect(queryByText('Enter an amount.')).toBeNull();
  });

  it('should not render the old pill chips or the segmented control', () => {
    const { queryByTestId } = render(<JoinMembership />);
    for (const a of [5, 10, 20, 'other']) expect(queryByTestId(`amount-chip-${a}`)).toBeNull();
    expect(queryByTestId('interval-segment')).toBeNull();
  });

  it('should default to 10 euros monthly with the plain summary', () => {
    const { getByText, getByTestId } = render(<JoinMembership />);
    expect(getByText('€10 every month.')).toBeTruthy();
    expect(getByText(/Renews automatically, cancel anytime from your account\./)).toBeTruthy();
  });

  it('should show the yearly rows and summary when Yearly is pressed', () => {
    const { getByText, getByTestId } = render(<JoinMembership />);
    fireEvent.press(getByTestId('interval-tab-year'));
    expect(getByText('€60 a year')).toBeTruthy();
    expect(getByText('€120 a year')).toBeTruthy();
    expect(getByText('€240 a year')).toBeTruthy();
    expect(getByText('€120 every year.')).toBeTruthy();
  });

  it('should disable continue and show the minimum message when Another amount is below the minimum', () => {
    const { getByText, getByLabelText, getByTestId } = render(<JoinMembership />);
    fireEvent.press(getByTestId('amount-row-other'));
    expect(getByText('per month · minimum €5')).toBeTruthy();
    fireEvent.changeText(getByLabelText('Amount'), '4');
    expect(getByText(/at least €5/)).toBeTruthy();
    fireEvent.press(getByText('Continue to payment'));
    expect(join).not.toHaveBeenCalled();
  });

  it('should call join with 10, month and the language when continue is pressed', async () => {
    join.mockResolvedValue({ success: true, data: { url: 'https://pay.example/x', ...manifestData } });
    const onJoined = jest.fn();
    const { getByText, getByTestId } = render(<JoinMembership onJoined={onJoined} />);
    fireEvent.press(getByText('Continue to payment'));
    await waitFor(() => expect(join).toHaveBeenCalledWith(10, 'month', 'en'));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('https://pay.example/x'));
  });

  describe('moving on to the in-app payment screen', () => {
    const originalOS = Platform.OS;
    const originalWindow = (global as any).window;
    afterEach(() => {
      (Platform as any).OS = originalOS;
      (global as any).window = originalWindow;
    });

    it('should navigate to /membership/pay with the manifest, amount and interval instead of setting window.location', async () => {
      (Platform as any).OS = 'web';
      const location = { href: 'unchanged' };
      (global as any).window = { ...originalWindow, location };
      join.mockResolvedValue({ success: true, data: { url: 'https://pay.example/x', ...manifestData } });
      const { getByText, getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-20'));
      fireEvent.press(getByText('Continue to payment'));
      await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
      expect(mockPush).toHaveBeenCalledWith(
        '/membership/pay?id=chk-1&session=sess%201%2Fx&amount=20&interval=month&testing=1',
      );
      expect(location.href).toBe('unchanged');
    });

    it('should pass testing=0 and the yearly interval through', async () => {
      join.mockResolvedValue({ success: true, data: { url: 'u', checkout: { id: 'c', session: 's' }, testing: false } });
      const { getByText, getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('interval-tab-year'));
      fireEvent.press(getByText('Continue to payment'));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/membership/pay?id=c&session=s&amount=120&interval=year&testing=0'));
    });

    it('should show the generic error and not navigate when the answer has no checkout manifest', async () => {
      join.mockResolvedValue({ success: true, data: { url: 'https://pay.example/x' } });
      const { getByText } = render(<JoinMembership />);
      fireEvent.press(getByText('Continue to payment'));
      await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('should show the localized range message on INVALID_CONTRIBUTION', async () => {
    join.mockResolvedValue({ success: false, error: 'raw api text', code: 'INVALID_CONTRIBUTION' });
    const { getByText, queryByText, getByTestId } = render(<JoinMembership />);
    fireEvent.press(getByText('Continue to payment'));
    await waitFor(() => expect(getByText('The amount must be between €5 and €1000.')).toBeTruthy());
    expect(queryByText('raw api text')).toBeNull();
  });

  it('should show a localized generic error, never the raw server text, for other failures', async () => {
    join.mockResolvedValue({ success: false, error: 'You already have an active subscription' });
    const { getByText, queryByText, getByTestId } = render(<JoinMembership />);
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
    const { getByText, getByTestId } = render(<JoinMembership />);
    fireEvent.press(getByText('Continue to payment'));
    await waitFor(() => expect(getByText('Your first payment is still being processed.')).toBeTruthy());
  });

  it('should route a signed-out visitor to the magic link with returnTo', () => {
    mockAuthed = false;
    const { getByText, getByTestId } = render(<JoinMembership />);
    fireEvent.press(getByText('Continue to payment'));
    expect(join).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/magic-link',
      params: { returnTo: '/membership' },
    });
  });

  describe('Other amount', () => {
    it('should show the neutral helper, no error and a disabled button right after pressing Another amount', () => {
      const { getByText, queryByText, getByLabelText, getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      expect(getByText('per month · minimum €5')).toBeTruthy();
      expect(queryByText('Enter an amount.')).toBeNull();
      expect(getByLabelText('Amount').props.value).toBe('');
      fireEvent.press(getByText('Continue to payment'));
      expect(join).not.toHaveBeenCalled();
    });

    it('should show the error after typing a value below the minimum', () => {
      const { getByText, getByLabelText, getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      fireEvent.changeText(getByLabelText('Amount'), '3');
      expect(getByText(/at least €5/)).toBeTruthy();
    });

    it('should accept 12, clear the error and enable continue with the summary', async () => {
      join.mockResolvedValue({ success: true, data: { url: 'https://pay.example/x', ...manifestData } });
      const { getByText, queryByText, getByLabelText, getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      fireEvent.changeText(getByLabelText('Amount'), '3');
      fireEvent.changeText(getByLabelText('Amount'), '12');
      expect(queryByText(/at least/)).toBeNull();
      expect(getByText('€12 every month.')).toBeTruthy();
      fireEvent.press(getByText('Continue to payment'));
      await waitFor(() => expect(join).toHaveBeenCalledWith(12, 'month', 'en'));
    });

    it('should show the error for a typed invalid value once the field is left', () => {
      // An empty field never shows red (see the test above); a typed invalid value does.
      const { getByText, getByLabelText, getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      fireEvent.changeText(getByLabelText('Amount'), 'abc');
      fireEvent(getByLabelText('Amount'), 'blur');
      expect(getByText('Enter an amount.')).toBeTruthy();
    });

    it('should use a muted placeholder colour', () => {
      const { getByText, getByLabelText, getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      expect(getByLabelText('Amount').props.placeholderTextColor).toBe(colors.gray[400]);
    });

    it('should render the euro symbol after the input, not before', () => {
      const { getByText, getByLabelText, toJSON, getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      const json = JSON.stringify(toJSON());
      const inputAt = json.indexOf('"accessibilityLabel":"Amount"');
      const euroAt = json.indexOf('"€"');
      expect(inputAt).toBeGreaterThan(-1);
      expect(euroAt).toBeGreaterThan(inputAt);
      expect(getByLabelText('Amount')).toBeTruthy();
    });
  });

  describe('layout of the Another amount row', () => {
    it('should put the input right after the label, before the euro sign, left-aligned', () => {
      const { getByLabelText, getByTestId, toJSON } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      const json = JSON.stringify(toJSON());
      const labelAt = json.indexOf('Another amount');
      const inputAt = json.indexOf('"accessibilityLabel":"Amount"');
      const euroAt = json.indexOf('"€"');
      expect(labelAt).toBeGreaterThan(-1);
      expect(inputAt).toBeGreaterThan(labelAt);
      expect(euroAt).toBeGreaterThan(inputAt);
      expect(StyleSheet.flatten(getByLabelText('Amount').props.style).textAlign).toBe('left');
    });

    it('should not stretch the label so the input stays next to it', () => {
      const { getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      expect(StyleSheet.flatten(getByTestId('amount-row-other').props.style).flex).toBeUndefined();
    });
  });

  describe('vertical rhythm', () => {
    const top = (node: any) => StyleSheet.flatten(node.props.style).marginTop;
    it('should expose the spacing scale as named constants', () => {
      expect(space).toMatchObject({ title: 20, block: 32, tight: 10, action: 24, fine: 14 });
    });

    it('should space each block of the join page by the scale', () => {
      const { getByTestId } = render(<JoinMembership />);
      expect(top(getByTestId('join-quote'))).toBe(20);
      expect(top(getByTestId('join-tabs'))).toBe(32);
      expect(top(getByTestId('join-label'))).toBe(32);
      expect(StyleSheet.flatten(getByTestId('join-label').props.style).marginBottom).toBe(10);
      expect(top(getByTestId('join-summary'))).toBe(32);
      expect(top(getByTestId('join-continue'))).toBe(24);
      expect(top(getByTestId('join-fine'))).toBe(14);
    });

    it('should leave 10 above the custom amount helper line', () => {
      const { getByTestId } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      expect(top(getByTestId('amount-helper'))).toBe(10);
    });

    it('should not use negative margins on the label', () => {
      const { getByTestId } = render(<JoinMembership />);
      expect(StyleSheet.flatten(getByTestId('join-label').props.style).marginBottom).toBeGreaterThanOrEqual(0);
    });
  });

  describe('remembering choices per interval', () => {
    it('should start on Monthly with 10 euros selected', () => {
      const { getByTestId, getByText } = render(<JoinMembership />);
      expect(getByTestId('interval-tab-month').props.accessibilityState.selected).toBe(true);
      expect(getByTestId('amount-row-10').props.accessibilityState.checked).toBe(true);
      expect(getByText('€10 every month.')).toBeTruthy();
    });

    it('should restore a monthly custom amount after a trip to Yearly, which starts at 120', () => {
      const { getByTestId, getByLabelText, getByText } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      fireEvent.changeText(getByLabelText('Amount'), '12');
      fireEvent.press(getByTestId('interval-tab-year'));
      expect(getByTestId('amount-row-120').props.accessibilityState.checked).toBe(true);
      expect(getByText('€120 every year.')).toBeTruthy();
      fireEvent.press(getByTestId('interval-tab-month'));
      expect(getByTestId('amount-row-other').props.accessibilityState.checked).toBe(true);
      expect(getByLabelText('Amount').props.value).toBe('12');
      expect(getByText('€12 every month.')).toBeTruthy();
    });

    it('should restore a yearly preset after a trip to Monthly', () => {
      const { getByTestId, getByText } = render(<JoinMembership />);
      fireEvent.press(getByTestId('interval-tab-year'));
      fireEvent.press(getByTestId('amount-row-240'));
      fireEvent.press(getByTestId('interval-tab-month'));
      expect(getByText('€10 every month.')).toBeTruthy();
      fireEvent.press(getByTestId('interval-tab-year'));
      expect(getByTestId('amount-row-240').props.accessibilityState.checked).toBe(true);
      expect(getByText('€240 every year.')).toBeTruthy();
    });

    it('should bring the typed amount back when Another amount is chosen again after a preset', () => {
      const { getByTestId, getByLabelText } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      fireEvent.changeText(getByLabelText('Amount'), '15');
      fireEvent.press(getByTestId('amount-row-5'));
      fireEvent.press(getByTestId('amount-row-other'));
      expect(getByLabelText('Amount').props.value).toBe('15');
    });

    it('should join with the visible interval state after switching back and forth', async () => {
      join.mockResolvedValue({ success: true, data: { url: 'u', ...manifestData } });
      const { getByTestId, getByLabelText, getByText } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      fireEvent.changeText(getByLabelText('Amount'), '12');
      fireEvent.press(getByTestId('interval-tab-year'));
      fireEvent.press(getByTestId('interval-tab-month'));
      fireEvent.press(getByText('Continue to payment'));
      await waitFor(() => expect(join).toHaveBeenCalledWith(12, 'month', 'en'));
    });

    it('should keep the neutral helper and no error when Another amount is chosen again untouched', () => {
      const { getByTestId, getByText, queryByText } = render(<JoinMembership />);
      fireEvent.press(getByTestId('amount-row-other'));
      fireEvent.press(getByTestId('interval-tab-year'));
      fireEvent.press(getByTestId('interval-tab-month'));
      expect(getByText('per month · minimum €5')).toBeTruthy();
      expect(queryByText('Enter an amount.')).toBeNull();
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

    it('should hide the browser outline on an amount row after a mouse focus', () => {
      const { getByTestId } = render(<JoinMembership />);
      fireEvent(getByTestId('amount-row-5'), 'focus', { target: { matches: () => false } });
      expect(flat(getByTestId('amount-row-5')).outlineStyle).toBe('none');
    });

    it('should show a burgundy outline on an amount row after a keyboard focus', () => {
      const { getByTestId } = render(<JoinMembership />);
      fireEvent(getByTestId('amount-row-5'), 'focus', { target: { matches: () => true } });
      const style = flat(getByTestId('amount-row-5'));
      expect(style.outlineStyle).toBe('solid');
      expect(style.outlineColor).toBe(colors.burgundy[500]);
    });

    it('should do the same for the Monthly and Yearly tabs', () => {
      const { getByTestId } = render(<JoinMembership />);
      expect(flat(getByTestId('interval-tab-year')).outlineStyle).toBe('none');
      fireEvent(getByTestId('interval-tab-year'), 'focus', { target: { matches: () => true } });
      expect(flat(getByTestId('interval-tab-year')).outlineColor).toBe(colors.burgundy[500]);
    });
  });
});
