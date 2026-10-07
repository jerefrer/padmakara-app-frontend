import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import PayScreen from '@/app/(tabs)/membership/pay';

const mockReplace = jest.fn();
const mockRedirect = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string | string[] | undefined> = {};
let mockCheckoutProps: any = null;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  router: {
    replace: (...a: any[]) => mockReplace(...a),
    push: jest.fn(),
    back: () => mockBack(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/components/membership/EasypayCheckout', () => {
  const { View } = require('react-native');
  return {
    EasypayCheckout: (props: any) => {
      mockCheckoutProps = props;
      return <View testID="easypay-checkout" nativeID="easypay-checkout" />;
    },
  };
});

const originalOS = Platform.OS;
const valid = { id: 'chk-9', session: 'sess 9/x', amount: '10', interval: 'month', testing: '1' };

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckoutProps = null;
  mockParams = { ...valid };
  (Platform as any).OS = 'web';
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('membership pay screen', () => {
  it('should render the form container with the manifest and testing flag from the URL', () => {
    const { getByTestId, getByText } = render(<PayScreen />);
    expect(getByTestId('easypay-checkout')).toBeTruthy();
    expect(mockCheckoutProps.manifest).toEqual({ id: 'chk-9', session: 'sess 9/x' });
    expect(mockCheckoutProps.testing).toBe(true);
    expect(mockCheckoutProps.language).toBe('en');
    expect(getByText('Payment')).toBeTruthy();
  });

  it('should use the live environment when testing is 0', () => {
    mockParams = { ...valid, testing: '0' };
    render(<PayScreen />);
    expect(mockCheckoutProps.testing).toBe(false);
  });

  it('should show the steps, the order summary and the reassurance under the form', () => {
    const { getByText } = render(<PayScreen />);
    expect(getByText('1 Contribution')).toBeTruthy();
    expect(getByText('2 Payment')).toBeTruthy();
    expect(getByText('3 Confirmation')).toBeTruthy();
    expect(getByText('Your membership')).toBeTruthy();
    expect(getByText('Monthly contribution')).toBeTruthy();
    expect(getByText('€10.00')).toBeTruthy();
    expect(getByText('First payment today, then every month until you cancel.')).toBeTruthy();
    expect(getByText('Membership terms')).toBeTruthy();
    expect(getByText('🔒 Card details go to Easypay, never to Padmakara.')).toBeTruthy();
  });

  it('should word the yearly order and sentence for a yearly contribution', () => {
    mockParams = { ...valid, amount: '120', interval: 'year' };
    const { getByText } = render(<PayScreen />);
    expect(getByText('Yearly contribution')).toBeTruthy();
    expect(getByText('€120.00')).toBeTruthy();
    expect(getByText('First payment today, then every year until you cancel.')).toBeTruthy();
  });

  it('should offer Change amount as the back control when joining', () => {
    const { getByLabelText } = render(<PayScreen />);
    fireEvent.press(getByLabelText('Change amount'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('should hide the steps and say Back when updating the payment method', () => {
    mockParams = { ...valid, mode: 'update' };
    const { queryByText, getByLabelText } = render(<PayScreen />);
    expect(queryByText('1 Contribution')).toBeNull();
    expect(getByLabelText('Back')).toBeTruthy();
  });

  it.each([
    ['missing id', { ...valid, id: undefined }],
    ['missing session', { ...valid, session: undefined }],
    ['empty session', { ...valid, session: '' }],
  ])('should show the invalid-link message and no form when %s', (_n, params) => {
    mockParams = params as any;
    const { getByText, queryByTestId } = render(<PayScreen />);
    expect(getByText('This payment link is no longer valid.')).toBeTruthy();
    expect(queryByTestId('easypay-checkout')).toBeNull();
    fireEvent.press(getByText('Back to membership'));
    expect(mockReplace).toHaveBeenCalledWith('/membership');
  });

  it('should redirect to the tabs and render no form on native', () => {
    (Platform as any).OS = 'ios';
    const { queryByTestId, queryByText } = render(<PayScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(queryByTestId('easypay-checkout')).toBeNull();
    expect(queryByText('Payment')).toBeNull();
  });

  it('should go to the confirming screen on success', () => {
    render(<PayScreen />);
    mockCheckoutProps.onSuccess();
    expect(mockReplace).toHaveBeenCalledWith('/membership/confirming?checkout=chk-9');
  });

  it('should add mode=update to the confirming URL when updating', () => {
    mockParams = { ...valid, mode: 'update' };
    render(<PayScreen />);
    mockCheckoutProps.onSuccess();
    expect(mockReplace).toHaveBeenCalledWith('/membership/confirming?checkout=chk-9&mode=update');
  });

  it('should go to the closed screen when the form is closed, or the membership page when updating', () => {
    const first = render(<PayScreen />);
    mockCheckoutProps.onClose();
    expect(mockReplace).toHaveBeenLastCalledWith('/membership/closed');
    first.unmount();
    mockParams = { ...valid, mode: 'update' };
    render(<PayScreen />);
    mockCheckoutProps.onClose();
    expect(mockReplace).toHaveBeenLastCalledWith('/membership');
  });

  it('should skip the form and go straight to confirming in API mock mode', () => {
    mockParams = { ...valid, session: 'mock' };
    const { queryByTestId } = render(<PayScreen />);
    expect(queryByTestId('easypay-checkout')).toBeNull();
    expect(mockCheckoutProps).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/membership/confirming?checkout=chk-9');
  });

  it('should keep mode=update when skipping the form in API mock mode', () => {
    mockParams = { ...valid, session: 'mock', mode: 'update' };
    render(<PayScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/membership/confirming?checkout=chk-9&mode=update');
  });

  it('should show the declined sentence above the form on a payment error', () => {
    const { queryByText, getByText, getByTestId } = render(<PayScreen />);
    expect(queryByText('Your payment was declined. Nothing was charged.')).toBeNull();
    fireEvent(getByTestId('easypay-checkout'), 'layout');
    require('react-test-renderer').act(() => mockCheckoutProps.onPaymentError());
    expect(getByText('Your payment was declined. Nothing was charged.')).toBeTruthy();
    expect(getByTestId('easypay-checkout')).toBeTruthy();
  });

  it('should replace the form with a message and a way back on a fatal error', () => {
    const { getByText, queryByTestId } = render(<PayScreen />);
    require('react-test-renderer').act(() => mockCheckoutProps.onFatal());
    expect(getByText('The payment form could not be loaded. Please try again.')).toBeTruthy();
    expect(queryByTestId('easypay-checkout')).toBeNull();
    fireEvent.press(getByText('Back to membership'));
    expect(mockReplace).toHaveBeenCalledWith('/membership');
  });

  it('should render from URL params alone so a reload keeps working', () => {
    const first = render(<PayScreen />);
    first.unmount();
    const second = render(<PayScreen />);
    expect(second.getByTestId('easypay-checkout')).toBeTruthy();
  });
});
