import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import MembershipScreen from '@/app/(tabs)/membership/index';
import { membershipService } from '@/services/membershipService';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = false;

jest.mock('expo-router', () => ({
  router: {
    replace: (...a: any[]) => mockReplace(...a),
    push: jest.fn(),
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack,
  },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { name: 'Ana', email: 'ana@example.com' } }),
}));
jest.mock('@/services/membershipService', () => ({
  membershipService: { get: jest.fn(), join: jest.fn() },
}));

const get = membershipService.get as jest.Mock;
const originalOS = Platform.OS;

const view = (overrides: Record<string, unknown> = {}) => ({
  state: 'none', source: null, amount: null, interval: null, accessUntil: null, graceUntil: null,
  cancelledAt: null, method: null, history: [], lastPaymentFailedAt: null, ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = false;
  (Platform as any).OS = 'web';
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('membership screen', () => {
  it('should show the processing notice, never the join screen, while a first payment is processing', async () => {
    get.mockResolvedValue({ success: true, data: view({ state: 'processing' }) });
    const { getByText, queryByText } = render(<MembershipScreen />);
    await waitFor(() => expect(getByText('Your bank is processing the payment')).toBeTruthy());
    expect(queryByText('Become a member')).toBeNull();
    fireEvent.press(getByText('Back to Padmakara'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('should show the join screen for a member with no payment in flight', async () => {
    get.mockResolvedValue({ success: true, data: view() });
    const { getByText } = render(<MembershipScreen />);
    await waitFor(() => expect(getByText('Become a member')).toBeTruthy());
  });

  it('should show the failed-payment banner above the picker when the last payment failed', async () => {
    get.mockResolvedValue({ success: true, data: view({ lastPaymentFailedAt: '2026-10-06T10:00:00.000Z' }) });
    const { getByText } = render(<MembershipScreen />);
    await waitFor(() =>
      expect(
        getByText(
          "Your last payment didn't go through. Nothing was charged. You can try again with another card or bank account.",
        ),
      ).toBeTruthy(),
    );
  });

  it('should render a back control on the join screen that goes to the tabs when there is no history', async () => {
    get.mockResolvedValue({ success: true, data: view() });
    const { getByText, getByLabelText } = render(<MembershipScreen />);
    await waitFor(() => expect(getByText('Become a member')).toBeTruthy());
    fireEvent.press(getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('should go back one screen when there is history', async () => {
    mockCanGoBack = true;
    get.mockResolvedValue({ success: true, data: view() });
    const { getByText, getByLabelText } = render(<MembershipScreen />);
    await waitFor(() => expect(getByText('Become a member')).toBeTruthy());
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('should render exactly one back control while a first payment is processing', async () => {
    get.mockResolvedValue({ success: true, data: view({ state: 'processing' }) });
    const { getByText, getAllByLabelText } = render(<MembershipScreen />);
    await waitFor(() => expect(getByText('Your bank is processing the payment')).toBeTruthy());
    expect(getAllByLabelText('Back')).toHaveLength(1);
  });
});
