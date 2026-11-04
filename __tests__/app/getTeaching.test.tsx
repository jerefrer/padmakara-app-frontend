import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import GetScreen from '@/app/(tabs)/get/[id]/index';
import DoneScreen, { POLL_CAP_MS } from '@/app/(tabs)/get/[id]/done';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRedirect = jest.fn();
const mockOpenSignIn = jest.fn();
let mockParams: Record<string, string | undefined> = {};
let mockCheckoutProps: any = null;
let mockAuth: any = {};

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  router: { replace: (...a: any[]) => mockReplace(...a), push: (...a: any[]) => mockPush(...a) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/components/auth/SignInProvider', () => ({
  useSignIn: () => ({ openSignIn: (...a: any[]) => mockOpenSignIn(...a) }),
}));
jest.mock('@/components/membership/EasypayCheckout', () => {
  const { View } = require('react-native');
  return {
    EasypayCheckout: (props: any) => {
      mockCheckoutProps = props;
      return <View testID="easypay-checkout" />;
    },
  };
});
const mockSync = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/syncService', () => ({
  __esModule: true,
  default: { checkAndSync: (...a: any[]) => mockSync(...a) },
}));
const mockRefreshUser = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockCheckout = jest.fn();
const mockOrder = jest.fn();
jest.mock('@/services/teachingService', () => ({
  teachingService: {
    get: (...a: any[]) => mockGet(...a),
    checkout: (...a: any[]) => mockCheckout(...a),
    order: (...a: any[]) => mockOrder(...a),
  },
}));

const teaching = {
  id: 7,
  titleEn: 'Heart Sutra',
  titlePt: 'Sutra do Coração',
  startDate: '2026-04-12',
  endDate: '2026-04-13',
  imageUrl: null,
  teachers: [{ name: 'Rinpoche' }],
  places: [{ name: 'Lisbon' }],
  sessionCount: 4,
  published: true,
  saleMode: 'paid',
  priceCents: 1500,
  includedInMembership: false,
};
const signedIn = {
  isAuthenticated: true,
  hasActiveSubscription: false,
  user: { name: 'Ana Silva', email: 'ana@example.com' },
  refreshUserData: () => mockRefreshUser(),
};
const signedOut = { isAuthenticated: false, hasActiveSubscription: false, user: null };
const originalOS = Platform.OS;

beforeEach(() => {
  mockParams = { id: '7' };
  mockCheckoutProps = null;
  mockAuth = { ...signedOut };
  mockGet.mockResolvedValue({ success: true, data: teaching });
  (Platform as any).OS = 'web';
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

async function fill(utils: ReturnType<typeof render>, consent = true) {
  await waitFor(() => utils.getByLabelText('First name'));
  fireEvent.changeText(utils.getByLabelText('First name'), 'Ana');
  fireEvent.changeText(utils.getByLabelText('Last name'), 'Silva');
  fireEvent.changeText(utils.getByLabelText('Email'), 'ana@example.com');
  if (consent) fireEvent.press(utils.getByRole('checkbox'));
}

describe('get teaching page', () => {
  it('should redirect home and show nothing on native', () => {
    (Platform as any).OS = 'ios';
    const { queryByText } = render(<GetScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(mockGet).not.toHaveBeenCalled();
    expect(queryByText('Heart Sutra')).toBeNull();
  });

  it('should show the event card, the price and the hardship line', async () => {
    const { findByText, getByText, getByTestId } = render(<GetScreen />);
    await findByText('Heart Sutra');
    expect(getByText('4 sessions')).toBeTruthy();
    expect(getByTestId('teaching-price').props.children).toBe('€15.00');
    expect(getByText("Can't afford it? Write to info@padmakara.pt")).toBeTruthy();
  });

  it('should say Free and offer the free button for a free teaching', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, saleMode: 'free', priceCents: null } });
    const { findByText, getByText } = render(<GetScreen />);
    await findByText('Heart Sutra');
    expect(getByText('Free')).toBeTruthy();
    expect(getByText('Get the recordings')).toBeTruthy();
  });

  it('should say recordings are coming soon when the event is unpublished', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, published: false } });
    const { findByText } = render(<GetScreen />);
    expect(await findByText('Recordings coming soon')).toBeTruthy();
  });

  it('should show the not-available message on a 404', async () => {
    mockGet.mockResolvedValue({ success: false, status: 404 });
    const { findByText } = render(<GetScreen />);
    expect(await findByText('These recordings are not available.')).toBeTruthy();
  });

  it('should require a name, a valid email and the consent before calling the API', async () => {
    const utils = render(<GetScreen />);
    await utils.findByText('Heart Sutra');
    fireEvent.press(utils.getByText('Continue to payment'));
    expect(utils.getByText('Please enter your first and last name.')).toBeTruthy();

    await fill(utils, false);
    fireEvent.changeText(utils.getByLabelText('Email'), 'not-an-email');
    fireEvent.press(utils.getByText('Continue to payment'));
    expect(utils.getByText('Please enter a valid email address.')).toBeTruthy();

    fireEvent.changeText(utils.getByLabelText('Email'), 'ana@example.com');
    fireEvent.press(utils.getByText('Continue to payment'));
    expect(utils.getByText('Please tick the box to continue.')).toBeTruthy();
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('should show the consent sentence', async () => {
    const { findByText } = render(<GetScreen />);
    expect(
      await findByText('I agree that Associação Padmakara processes my data to give me access to these recordings.'),
    ).toBeTruthy();
  });

  it('should show the benefactor-members-only line under the price when membersOnly is set', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, membersOnly: true } });
    const { findByText } = render(<GetScreen />);
    expect(await findByText('For benefactor members only.')).toBeTruthy();
  });

  it('should not show the members-only line for an ordinary teaching', async () => {
    const { findByText, queryByText } = render(<GetScreen />);
    await findByText('Heart Sutra');
    expect(queryByText('For benefactor members only.')).toBeNull();
  });

  it('should explain and link to the membership page when checkout answers MEMBERS_ONLY', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, membersOnly: true } });
    mockCheckout.mockResolvedValue({ success: false, status: 403, code: 'MEMBERS_ONLY' });
    const utils = render(<GetScreen />);
    await fill(utils);
    fireEvent.press(utils.getByText('Continue to payment'));
    expect(
      await utils.findByText(
        'This teaching is for benefactor members. Sign in with the email of your membership, or become a member first.',
      ),
    ).toBeTruthy();
    fireEvent.press(utils.getByText('Become a benefactor member'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
    expect(utils.queryByText('Something went wrong. Please try again.')).toBeNull();
  });

  it('should show the done state after a free grant', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, saleMode: 'free', priceCents: null } });
    mockCheckout.mockResolvedValue({ success: true, data: { status: 'granted' } });
    const utils = render(<GetScreen />);
    await fill(utils);
    fireEvent.press(utils.getByText('Get the recordings'));
    expect(await utils.findByText('The recordings are in your account')).toBeTruthy();
    expect(mockCheckout).toHaveBeenCalledWith('7', {
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Silva',
      language: 'en',
      consent: true,
    });
    fireEvent.press(utils.getByText('Sign in'));
    expect(mockOpenSignIn).toHaveBeenCalled();
  });

  it('should embed the Easypay form for a paid teaching and go to the done page on success', async () => {
    mockCheckout.mockResolvedValue({
      success: true,
      data: { status: 'checkout', orderId: 'ord-1', checkout: { id: 'c1', session: 's1' }, testing: true },
    });
    const utils = render(<GetScreen />);
    await fill(utils);
    fireEvent.press(utils.getByText('Continue to payment'));
    await utils.findByTestId('easypay-checkout');
    expect(mockCheckoutProps.manifest).toEqual({ id: 'c1', session: 's1' });
    expect(mockCheckoutProps.testing).toBe(true);
    act(() => mockCheckoutProps.onSuccess());
    expect(mockReplace).toHaveBeenCalledWith('/get/7/done?order=ord-1');
  });

  it('should skip the form in API mock mode', async () => {
    mockCheckout.mockResolvedValue({
      success: true,
      data: { status: 'checkout', orderId: 'ord-2', checkout: { id: 'mock_session', session: 'mock' }, testing: true },
    });
    const utils = render(<GetScreen />);
    await fill(utils);
    fireEvent.press(utils.getByText('Continue to payment'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/get/7/done?order=ord-2'));
    expect(mockCheckoutProps).toBeNull();
  });

  it('should ask a signed-out buyer who already has access to sign in on a 409', async () => {
    mockCheckout.mockResolvedValue({ success: false, status: 409, code: 'ALREADY_HAS_ACCESS' });
    const utils = render(<GetScreen />);
    await fill(utils);
    fireEvent.press(utils.getByText('Continue to payment'));
    expect(await utils.findByText('You already have these recordings')).toBeTruthy();
    expect(utils.getByText('Sign in to open them.')).toBeTruthy();
    fireEvent.press(utils.getByText('Sign in'));
    expect(mockOpenSignIn).toHaveBeenCalledWith({ returnTo: '/get/7' });
  });

  it('should offer to open the recordings on a 409 when signed in', async () => {
    mockAuth = {
      isAuthenticated: true,
      hasActiveSubscription: false,
      user: { name: 'Ana Silva', email: 'ana@example.com' },
    };
    mockCheckout.mockResolvedValue({ success: false, status: 409, code: 'ALREADY_HAS_ACCESS' });
    const utils = render(<GetScreen />);
    await fill(utils);
    fireEvent.press(utils.getByText('Continue to payment'));
    await utils.findByText('You already have these recordings');
    fireEvent.press(utils.getByText('Open the recordings'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(tabs)/(groups)/retreat/7'));
  });

  it('should show a payments-unavailable message on a 503', async () => {
    mockCheckout.mockResolvedValue({ success: false, status: 503, code: 'PAYMENTS_UNAVAILABLE' });
    const utils = render(<GetScreen />);
    await fill(utils);
    fireEvent.press(utils.getByText('Continue to payment'));
    expect(await utils.findByText('Payments are temporarily unavailable. Please try again later.')).toBeTruthy();
  });

  it('should prefill the name and lock the email when signed in', async () => {
    mockAuth = {
      isAuthenticated: true,
      hasActiveSubscription: false,
      user: { name: 'Ana Maria Silva', email: 'ana@example.com' },
    };
    const { findByLabelText } = render(<GetScreen />);
    const email = await findByLabelText('Email');
    expect(email.props.value).toBe('ana@example.com');
    expect(email.props.editable).toBe(false);
    expect((await findByLabelText('First name')).props.value).toBe('Ana');
    expect((await findByLabelText('Last name')).props.value).toBe('Maria Silva');
  });

  it('should show the benefactor line under the price when included in membership', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, includedInMembership: true } });
    const { findByText } = render(<GetScreen />);
    expect(await findByText('Included for benefactor members.')).toBeTruthy();
  });

  it('should show Included in your membership and an Open button instead of the form for an active member', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, includedInMembership: true } });
    mockAuth = {
      isAuthenticated: true,
      hasActiveSubscription: true,
      user: { name: 'Ana Silva', email: 'ana@example.com' },
    };
    const { findByText, queryByLabelText, queryByText } = render(<GetScreen />);
    await findByText('Included in your membership');
    expect(queryByLabelText('Email')).toBeNull();
    expect(queryByText('Continue to payment')).toBeNull();
    fireEvent.press(await findByText('Open the recordings'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(tabs)/(groups)/retreat/7'));
  });

  it('should still show the form to a member when the teaching is not included', async () => {
    mockAuth = { isAuthenticated: true, hasActiveSubscription: true, user: { name: 'Ana', email: 'a@b.pt' } };
    const { findByText, queryByText } = render(<GetScreen />);
    await findByText('Continue to payment');
    expect(queryByText('Included in your membership')).toBeNull();
  });
});

describe('get teaching page, errors and access refresh', () => {
  it('should show the generic error when the page cannot be loaded', async () => {
    mockGet.mockResolvedValue({ success: false, status: 500 });
    const { findByText } = render(<GetScreen />);
    expect(await findByText('We could not load this page. Please try again.')).toBeTruthy();
  });

  it('should refresh the user and the cached events after a free grant when signed in', async () => {
    mockAuth = signedIn;
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, saleMode: 'free', priceCents: null } });
    mockCheckout.mockResolvedValue({ success: true, data: { status: 'granted' } });
    const utils = render(<GetScreen />);
    await utils.findByLabelText('First name');
    fireEvent.press(utils.getByRole('checkbox'));
    fireEvent.press(utils.getByText('Get the recordings'));
    await utils.findByText('The recordings are in your account');
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
    expect(mockSync).toHaveBeenCalledWith({ force: true });
  });

  it('should not refresh anything after a free grant when signed out', async () => {
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, saleMode: 'free', priceCents: null } });
    mockCheckout.mockResolvedValue({ success: true, data: { status: 'granted' } });
    const utils = render(<GetScreen />);
    await fill(utils);
    fireEvent.press(utils.getByText('Get the recordings'));
    await utils.findByText('The recordings are in your account');
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('should refresh before opening the recordings', async () => {
    mockAuth = { ...signedIn, hasActiveSubscription: true };
    mockGet.mockResolvedValue({ success: true, data: { ...teaching, includedInMembership: true } });
    const { findByText } = render(<GetScreen />);
    fireEvent.press(await findByText('Open the recordings'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(tabs)/(groups)/retreat/7'));
    expect(mockRefreshUser).toHaveBeenCalled();
    expect(mockSync).toHaveBeenCalledWith({ force: true });
  });
});

describe('get teaching done page', () => {
  beforeEach(() => {
    mockParams = { id: '7', order: 'ord-1' };
  });

  it('should redirect home on native', () => {
    (Platform as any).OS = 'android';
    render(<DoneScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(mockOrder).not.toHaveBeenCalled();
  });

  it('should thank a paid buyer and offer to sign in when signed out', async () => {
    mockOrder.mockResolvedValue({ success: true, data: { status: 'paid', eventId: 7, method: 'cc', amountCents: 1500 } });
    const { findByText } = render(<DoneScreen />);
    expect(await findByText('Thank you')).toBeTruthy();
    fireEvent.press(await findByText('Sign in'));
    expect(mockOpenSignIn).toHaveBeenCalledWith({ returnTo: '/(tabs)/(groups)/retreat/7' });
  });

  it('should offer to open the recordings for a signed-in paid buyer', async () => {
    mockAuth = { isAuthenticated: true, hasActiveSubscription: false, user: { name: 'A', email: 'a@b.pt' } };
    mockOrder.mockResolvedValue({ success: true, data: { status: 'paid', eventId: 7, method: 'cc', amountCents: 1500 } });
    const { findByText } = render(<DoneScreen />);
    fireEvent.press(await findByText('Open the recordings'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/(groups)/retreat/7'));
  });

  it('should show the Multibanco reference while the payment is pending', async () => {
    mockOrder.mockResolvedValue({
      success: true,
      data: {
        status: 'pending',
        eventId: 7,
        method: 'mb',
        amountCents: 1500,
        mbReference: { entity: '12345', reference: '987 654 321', amount: 15 },
      },
    });
    const { findByText, getByText } = render(<DoneScreen />);
    expect(await findByText('Waiting for your payment')).toBeTruthy();
    expect(getByText("We'll email you when your payment is confirmed.")).toBeTruthy();
    expect(getByText('12345')).toBeTruthy();
    expect(getByText('987 654 321')).toBeTruthy();
    expect(getByText('€15.00')).toBeTruthy();
  });

  it('should keep polling a pending order until it is paid', async () => {
    jest.useFakeTimers();
    mockOrder
      .mockResolvedValueOnce({ success: true, data: { status: 'pending', eventId: 7, method: null, amountCents: 1500 } })
      .mockResolvedValue({ success: true, data: { status: 'paid', eventId: 7, method: 'cc', amountCents: 1500 } });
    const { findByText } = render(<DoneScreen />);
    await findByText('Waiting for your payment');
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(await findByText('Thank you')).toBeTruthy();
    expect(mockOrder).toHaveBeenCalledTimes(2);
  });

  it('should refresh access when a signed-in buyer\'s order turns paid, and not when signed out', async () => {
    mockAuth = signedIn;
    mockOrder.mockResolvedValue({ success: true, data: { status: 'paid', eventId: 7, method: 'cc', amountCents: 1500 } });
    const first = render(<DoneScreen />);
    await first.findByText('Thank you');
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
    expect(mockSync).toHaveBeenCalledWith({ force: true });
    first.unmount();
    jest.clearAllMocks();
    mockAuth = { ...signedOut };
    const second = render(<DoneScreen />);
    await second.findByText('Thank you');
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });

  it('should stop polling after the cap and say the payment is not confirmed yet', async () => {
    jest.useFakeTimers();
    mockOrder.mockResolvedValue({ success: true, data: { status: 'pending', eventId: 7, method: 'mb', amountCents: 1500 } });
    const { findByText } = render(<DoneScreen />);
    await findByText('Waiting for your payment');
    await act(async () => {
      jest.advanceTimersByTime(POLL_CAP_MS + 1);
    });
    expect(await findByText("Your payment is not confirmed yet. We'll email you as soon as it is.")).toBeTruthy();
    const calls = mockOrder.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(mockOrder.mock.calls.length).toBe(calls);
  });

  it('should offer a retry when the payment failed', async () => {
    mockOrder.mockResolvedValue({ success: true, data: { status: 'failed', eventId: 7, method: null, amountCents: 1500 } });
    const { findByText } = render(<DoneScreen />);
    expect(await findByText('Your payment was not completed. Nothing was charged.')).toBeTruthy();
    fireEvent.press(await findByText('Try again'));
    expect(mockReplace).toHaveBeenCalledWith('/get/7');
  });

  it('should show the invalid-link message without an order id or on a 404', async () => {
    mockParams = { id: '7' };
    const first = render(<DoneScreen />);
    expect(first.getByText('This payment link is no longer valid.')).toBeTruthy();
    first.unmount();
    mockParams = { id: '7', order: 'gone' };
    mockOrder.mockResolvedValue({ success: false, status: 404 });
    const second = render(<DoneScreen />);
    expect(await second.findByText('This payment link is no longer valid.')).toBeTruthy();
  });
});
