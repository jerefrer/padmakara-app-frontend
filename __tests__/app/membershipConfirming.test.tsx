import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import ConfirmingScreen from '@/app/membership/confirming';

const mockReplace = jest.fn();
const mockRedirect = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = false;
let mockParams: Record<string, string> = {};
let mockPhase = 'active';
let mockCheckoutArg: string | undefined;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  router: {
    replace: (...a: any[]) => mockReplace(...a),
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack,
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Ana Silva', email: 'ana@example.com' } }),
}));
jest.mock('@/components/membership/useCheckoutStatus', () => ({
  useCheckoutStatus: (checkout?: string) => {
    mockCheckoutArg = checkout;
    return { phase: mockPhase };
  },
}));

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = false;
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

  it('should show the spinner copy and no outcome while the payment is being confirmed', () => {
    mockPhase = 'checking';
    mockParams = { checkout: 'chk-1' };
    const { getByText, queryByText } = render(<ConfirmingScreen />);
    expect(getByText('Confirming your payment…')).toBeTruthy();
    expect(getByText('This usually takes a few seconds. You can keep this page open.')).toBeTruthy();
    expect(queryByText('Welcome to Padmakara')).toBeNull();
    expect(queryByText('Try again')).toBeNull();
  });

  it('should poll the checkout named in the URL', () => {
    mockPhase = 'checking';
    mockParams = { checkout: 'chk-42' };
    render(<ConfirmingScreen />);
    expect(mockCheckoutArg).toBe('chk-42');
  });

  it('should use the first checkout id when the URL repeats the parameter', () => {
    mockPhase = 'checking';
    mockParams = { checkout: ['chk-1', 'chk-2'] } as any;
    render(<ConfirmingScreen />);
    expect(mockCheckoutArg).toBe('chk-1');
  });

  it('should send the member to the retreats from the welcome screen', () => {
    mockParams = { checkout: 'chk-1' };
    const { getByText } = render(<ConfirmingScreen />);
    fireEvent.press(getByText('Go to my retreats'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('should show the processing notice, not the welcome, when a Direct Debit is at the bank', () => {
    mockPhase = 'processing';
    mockParams = { checkout: 'chk-1' };
    const { getByText, queryByText } = render(<ConfirmingScreen />);
    expect(getByText('Your bank is processing the payment')).toBeTruthy();
    expect(queryByText('Welcome to Padmakara')).toBeNull();
    fireEvent.press(getByText('Back to Padmakara'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('should say nothing was charged and offer a retry when the payment failed', () => {
    mockPhase = 'failed';
    mockParams = { checkout: 'chk-1' };
    const { getByText, queryByText } = render(<ConfirmingScreen />);
    expect(getByText('Your payment was declined. Nothing was charged.')).toBeTruthy();
    expect(queryByText('Welcome to Padmakara')).toBeNull();
    fireEvent.press(getByText('Try again'));
    expect(mockReplace).toHaveBeenCalledWith('/membership');
  });

  it('should say we will email when still unconfirmed after the timeout', () => {
    mockPhase = 'timeout';
    mockParams = { checkout: 'chk-1' };
    const { getByText } = render(<ConfirmingScreen />);
    expect(getByText("Still confirming. We'll email you as soon as it's done.")).toBeTruthy();
    fireEvent.press(getByText('See my membership'));
    expect(mockReplace).toHaveBeenCalledWith('/membership');
  });

  it('should not show a welcome or a payment method message in update mode while still checking', () => {
    mockPhase = 'checking';
    mockParams = { checkout: 'chk-1', mode: 'update' };
    const { getByText, queryByText } = render(<ConfirmingScreen />);
    expect(getByText('Confirming your payment…')).toBeTruthy();
    expect(queryByText('Payment method updated')).toBeNull();
  });

  it('should still show the failure copy in update mode when the payment failed', () => {
    mockPhase = 'failed';
    mockParams = { checkout: 'chk-1', mode: 'update' };
    const { getByText } = render(<ConfirmingScreen />);
    expect(getByText('Your payment was declined. Nothing was charged.')).toBeTruthy();
  });

  it('should redirect to the membership page when there is no checkout id', () => {
    mockPhase = 'missing';
    mockParams = {};
    render(<ConfirmingScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/membership');
  });

  it('should redirect to the tabs, showing no payment outcome, on native', () => {
    (Platform as any).OS = 'ios';
    mockParams = { checkout: 'chk-1' };
    const { queryByText } = render(<ConfirmingScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(queryByText('Welcome to Padmakara')).toBeNull();
  });

  it.each(['active', 'processing', 'failed', 'timeout'])(
    'should render one working back control in the %s state',
    (phase) => {
      mockPhase = phase;
      mockParams = { checkout: 'chk-1' };
      const { getAllByLabelText } = render(<ConfirmingScreen />);
      const backs = getAllByLabelText('Back');
      expect(backs).toHaveLength(1);
      fireEvent.press(backs[0]);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    },
  );

  it('should render the back control in the method updated state', () => {
    mockPhase = 'active';
    mockParams = { checkout: 'chk-1', mode: 'update' };
    const { getAllByLabelText } = render(<ConfirmingScreen />);
    expect(getAllByLabelText('Back')).toHaveLength(1);
  });

  it('should not render a back control while the payment is still being checked', () => {
    mockPhase = 'checking';
    mockParams = { checkout: 'chk-1' };
    const { queryByLabelText } = render(<ConfirmingScreen />);
    expect(queryByLabelText('Back')).toBeNull();
  });
});
