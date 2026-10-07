import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import ConfirmingScreen from '@/app/membership/confirming';

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
let mockPhase = 'active';

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { replace: (...a: any[]) => mockReplace(...a) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Ana Silva', email: 'ana@example.com' } }),
}));
jest.mock('@/components/membership/useCheckoutStatus', () => ({
  useCheckoutStatus: () => ({ phase: mockPhase }),
}));

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockPhase = 'active';
  (Platform as any).OS = 'web';
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('membership confirming screen', () => {
  it('should say the payment method was updated when a card update completes', () => {
    mockParams = { checkout: 'chk-1', mode: 'update' };
    const { getByText, queryByText } = render(<ConfirmingScreen />);
    expect(getByText('Payment method updated')).toBeTruthy();
    expect(queryByText('Welcome to Padmakara')).toBeNull();
    expect(queryByText(/confirmation email has been sent/)).toBeNull();
    fireEvent.press(getByText('Back to my membership'));
    expect(mockReplace).toHaveBeenCalledWith('/membership');
  });

  it('should welcome the member when a first payment completes', () => {
    mockParams = { checkout: 'chk-1' };
    const { getByText, queryByText } = render(<ConfirmingScreen />);
    expect(getByText('Welcome to Padmakara')).toBeTruthy();
    expect(queryByText('Payment method updated')).toBeNull();
  });

  it('should say a confirmation email, not a receipt, was sent on the welcome screen', () => {
    mockParams = { checkout: 'chk-1' };
    const { getByText, queryByText } = render(<ConfirmingScreen />);
    expect(getByText(/A confirmation email has been sent to ana@example.com/)).toBeTruthy();
    expect(queryByText(/receipt/i)).toBeNull();
  });
});
