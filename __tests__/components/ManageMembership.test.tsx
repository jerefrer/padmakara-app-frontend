import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import { ManageMembership } from '@/components/membership/ManageMembership';
import { membershipService, type MembershipView } from '@/services/membershipService';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/services/membershipService', () => ({
  membershipService: {
    cancel: jest.fn(),
    resume: jest.fn(),
    changeAmount: jest.fn(),
    updateMethod: jest.fn(),
  },
}));

const svc = membershipService as unknown as Record<string, jest.Mock>;

const base: MembershipView = {
  state: 'active',
  source: 'easypay',
  amount: 10,
  interval: 'month',
  accessUntil: '2026-11-07T00:00:00.000Z',
  graceUntil: null,
  cancelledAt: null,
  method: { type: 'card', lastFour: '0000', brand: 'Visa' },
  history: [{ date: '2026-10-07T00:00:00.000Z', amount: 10, outcome: 'paid' }],
  lastPaymentFailedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ManageMembership', () => {
  it('should list the three actions and the card when the membership is active', () => {
    const { getByText, getAllByText } = render(<ManageMembership membership={base} onChanged={jest.fn()} />);
    expect(getByText('● Active')).toBeTruthy();
    expect(getByText('€10 / month')).toBeTruthy();
    expect(getByText('Visa •••• 0000')).toBeTruthy();
    expect(getByText('Change amount')).toBeTruthy();
    expect(getByText('Update payment method')).toBeTruthy();
    expect(getAllByText('Cancel membership')).toHaveLength(1);
  });

  it('should cancel then notify when the member confirms the cancel dialog', async () => {
    svc.cancel.mockResolvedValue({ success: true, data: { url: '', accessUntil: null } });
    const onChanged = jest.fn();
    const { getByText, getAllByText } = render(<ManageMembership membership={base} onChanged={onChanged} />);
    fireEvent.press(getByText('Cancel membership'));
    expect(getByText('Cancel your membership?')).toBeTruthy();
    expect(getByText(/You keep full access until/)).toBeTruthy();
    expect(svc.cancel).not.toHaveBeenCalled();
    fireEvent.press(getAllByText('Cancel membership')[1]);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(svc.cancel).toHaveBeenCalledTimes(1);
  });

  it('should not cancel when the member keeps the membership', () => {
    const { getByText } = render(<ManageMembership membership={base} onChanged={jest.fn()} />);
    fireEvent.press(getByText('Cancel membership'));
    fireEvent.press(getByText('Keep my membership'));
    expect(svc.cancel).not.toHaveBeenCalled();
  });

  it('should show a localized generic error, never the raw server text, when cancelling fails', async () => {
    svc.cancel.mockResolvedValue({ success: false, error: 'No Easypay subscription found for this account' });
    const onChanged = jest.fn();
    const { getByText, getAllByText, queryByText } = render(<ManageMembership membership={base} onChanged={onChanged} />);
    fireEvent.press(getByText('Cancel membership'));
    fireEvent.press(getAllByText('Cancel membership')[1]);
    await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
    expect(queryByText(/Easypay subscription/)).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('should show the localized message for a known error code when resuming fails', async () => {
    svc.resume.mockResolvedValue({ success: false, error: 'raw', code: 'ACCESS_ENDED' });
    const { getByText } = render(
      <ManageMembership membership={{ ...base, state: 'cancelled', cancelledAt: '2026-10-08T00:00:00.000Z' }} onChanged={jest.fn()} />,
    );
    fireEvent.press(getByText('Resume membership'));
    await waitFor(() => expect(getByText('Your membership has ended. Please join again.')).toBeTruthy());
  });

  it('should show the payment-provider message when the update checkout cannot be opened', async () => {
    svc.updateMethod.mockResolvedValue({ success: false, error: 'raw', code: 'EASYPAY_UNAVAILABLE' });
    const { getByText } = render(<ManageMembership membership={base} onChanged={jest.fn()} />);
    fireEvent.press(getByText('Update payment method'));
    await waitFor(() =>
      expect(getByText('We could not reach the payment provider. Nothing was changed. Please try again later.')).toBeTruthy(),
    );
  });

  it('should offer resume and hide cancel and next payment when the membership is cancelled', async () => {
    svc.resume.mockResolvedValue({ success: true, data: { accessUntil: '' } });
    const onChanged = jest.fn();
    const { getByText, queryByText } = render(
      <ManageMembership membership={{ ...base, state: 'cancelled', cancelledAt: '2026-10-08T00:00:00.000Z' }} onChanged={onChanged} />,
    );
    expect(getByText(/^Ends /)).toBeTruthy();
    expect(queryByText('Cancel membership')).toBeNull();
    expect(queryByText('Next payment')).toBeNull();
    fireEvent.press(getByText('Resume membership'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(svc.resume).toHaveBeenCalledTimes(1);
  });

  it('should show the grace date banner and a primary update button when a payment failed', () => {
    const { getByText, queryByText } = render(
      <ManageMembership
        membership={{ ...base, state: 'payment_failed', graceUntil: '2026-11-14T00:00:00.000Z' }}
        onChanged={jest.fn()}
      />,
    );
    expect(getByText('● Payment needed')).toBeTruthy();
    expect(
      getByText(/Your last payment didn't go through\. Your access continues until .*2026.*\. Update your payment method to keep it\./),
    ).toBeTruthy();
    expect(getByText('Update payment method')).toBeTruthy();
    expect(queryByText('Change amount')).toBeNull();
  });

  it('should let the member cancel when a payment failed', async () => {
    svc.cancel.mockResolvedValue({ success: true, data: { url: '', accessUntil: null } });
    const onChanged = jest.fn();
    const { getByText, getAllByText } = render(
      <ManageMembership
        membership={{ ...base, state: 'payment_failed', graceUntil: '2026-11-14T00:00:00.000Z' }}
        onChanged={onChanged}
      />,
    );
    fireEvent.press(getByText('Cancel membership'));
    fireEvent.press(getAllByText('Cancel membership')[1]);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(svc.cancel).toHaveBeenCalledTimes(1);
  });

  it('should show contact copy and no actions when the membership was granted by an admin', () => {
    const { getByText, queryByText } = render(
      <ManageMembership membership={{ ...base, source: 'admin', method: null }} onChanged={jest.fn()} />,
    );
    expect(getByText('Contact us to change your membership')).toBeTruthy();
    expect(queryByText('Change amount')).toBeNull();
    expect(queryByText('Update payment method')).toBeNull();
    expect(queryByText('Cancel membership')).toBeNull();
  });

  it('should list the payment history with outcomes', () => {
    const { getByText } = render(
      <ManageMembership
        membership={{ ...base, history: [{ date: '2026-09-07T00:00:00.000Z', amount: 10, outcome: 'failed' }] }}
        onChanged={jest.fn()}
      />,
    );
    expect(getByText(/€10 · Failed/)).toBeTruthy();
  });

  it('should save the new amount and notify when the member changes the contribution', async () => {
    svc.changeAmount.mockResolvedValue({ success: true, data: { amount: 20 } });
    const onChanged = jest.fn();
    const { getByText } = render(<ManageMembership membership={base} onChanged={onChanged} />);
    fireEvent.press(getByText('Change amount'));
    expect(getByText(/Your new contribution applies from your next payment on/)).toBeTruthy();
    fireEvent.press(getByText('€20'));
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(svc.changeAmount).toHaveBeenCalledWith(20);
  });

  describe('update payment method', () => {
    const originalOS = Platform.OS;
    const originalWindow = (global as any).window;
    afterEach(() => {
      (Platform as any).OS = originalOS;
      (global as any).window = originalWindow;
    });

    it('should send the browser to the checkout URL the server returned', async () => {
      (Platform as any).OS = 'web';
      const location = { href: '' };
      (global as any).window = { ...originalWindow, location };
      svc.updateMethod.mockResolvedValue({ success: true, data: { url: 'https://api.test/checkout/chk-9?mode=update' } });
      const { getByText } = render(<ManageMembership membership={base} onChanged={jest.fn()} />);
      fireEvent.press(getByText('Update payment method'));
      await waitFor(() => expect(location.href).toBe('https://api.test/checkout/chk-9?mode=update'));
      expect(svc.updateMethod).toHaveBeenCalledWith('en');
    });

    it('should not navigate when the server returns no URL', async () => {
      (Platform as any).OS = 'web';
      const location = { href: 'unchanged' };
      (global as any).window = { ...originalWindow, location };
      svc.updateMethod.mockResolvedValue({ success: true, data: {} });
      const { getByText } = render(<ManageMembership membership={base} onChanged={jest.fn()} />);
      fireEvent.press(getByText('Update payment method'));
      await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
      expect(location.href).toBe('unchanged');
    });
  });

  it('should show the error and keep the resume button when resuming fails', async () => {
    svc.resume.mockResolvedValue({ success: false, error: 'raw', code: 'ACCESS_ENDED' });
    const onChanged = jest.fn();
    const { getByText } = render(
      <ManageMembership membership={{ ...base, state: 'cancelled', cancelledAt: '2026-10-08T00:00:00.000Z' }} onChanged={onChanged} />,
    );
    fireEvent.press(getByText('Resume membership'));
    await waitFor(() => expect(getByText('Your membership has ended. Please join again.')).toBeTruthy());
    expect(getByText('Resume membership')).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('should show the generic error and keep the resume button when the resume call throws', async () => {
    svc.resume.mockRejectedValue(new Error('network'));
    const { getByText } = render(
      <ManageMembership membership={{ ...base, state: 'cancelled', cancelledAt: '2026-10-08T00:00:00.000Z' }} onChanged={jest.fn()} />,
    );
    fireEvent.press(getByText('Resume membership'));
    await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
    expect(getByText('Resume membership')).toBeTruthy();
  });

  describe('a double press', () => {
    /** Two presses delivered before React re-renders, as a fast double tap is. */
    const pressTwice = (el: any) =>
      act(() => {
        fireEvent.press(el);
        fireEvent.press(el);
      });

    it('should resume once when Resume is pressed twice in a row', async () => {
      let finish!: (v: unknown) => void;
      svc.resume.mockReturnValue(new Promise((r) => (finish = r)));
      const onChanged = jest.fn();
      const { getByText } = render(
        <ManageMembership membership={{ ...base, state: 'cancelled', cancelledAt: '2026-10-08T00:00:00.000Z' }} onChanged={onChanged} />,
      );
      pressTwice(getByText('Resume membership'));
      await act(async () => finish({ success: true, data: { accessUntil: '' } }));
      expect(svc.resume).toHaveBeenCalledTimes(1);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('should cancel once when the confirm button of the cancel dialog is pressed twice in a row', async () => {
      let finish!: (v: unknown) => void;
      svc.cancel.mockReturnValue(new Promise((r) => (finish = r)));
      const onChanged = jest.fn();
      const { getByText, getAllByText } = render(<ManageMembership membership={base} onChanged={onChanged} />);
      fireEvent.press(getByText('Cancel membership'));
      pressTwice(getAllByText('Cancel membership')[1]);
      await act(async () => finish({ success: true, data: { url: '', accessUntil: null } }));
      expect(svc.cancel).toHaveBeenCalledTimes(1);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('without a known date', () => {
    it('should show no next payment row when accessUntil is missing', () => {
      const { queryByText, getByText } = render(
        <ManageMembership membership={{ ...base, accessUntil: null }} onChanged={jest.fn()} />,
      );
      expect(queryByText('Next payment')).toBeNull();
      expect(getByText('Contribution')).toBeTruthy();
    });

    it('should show the failed-payment banner without a dangling "until ." when graceUntil is missing', () => {
      const { getByText, queryByText } = render(
        <ManageMembership membership={{ ...base, state: 'payment_failed', graceUntil: null }} onChanged={jest.fn()} />,
      );
      expect(getByText("Your last payment didn't go through. Update your payment method to keep your access.")).toBeTruthy();
      expect(queryByText(/until/)).toBeNull();
    });

    it('should word the cancel dialog without a dangling "until ." when accessUntil is missing', () => {
      const { getByText, queryByText } = render(
        <ManageMembership membership={{ ...base, accessUntil: null }} onChanged={jest.fn()} />,
      );
      fireEvent.press(getByText('Cancel membership'));
      expect(
        getByText(
          'You keep full access until the end of the period you already paid for. No further payments will be taken.',
        ),
      ).toBeTruthy();
      expect(queryByText(/until \./)).toBeNull();
      expect(queryByText(/until ,/)).toBeNull();
    });

    it('should say Cancelled, not a blank "Ends", and drop "until then" when a cancelled member has no accessUntil', () => {
      const { getByText, queryByText } = render(
        <ManageMembership
          membership={{ ...base, state: 'cancelled', cancelledAt: '2026-10-08T00:00:00.000Z', accessUntil: null }}
          onChanged={jest.fn()}
        />,
      );
      expect(getByText('Cancelled')).toBeTruthy();
      expect(queryByText(/Ends/)).toBeNull();
      expect(queryByText(/until then/)).toBeNull();
    });

    it('should still show the dated sentences when the dates are known', () => {
      const { getByText } = render(
        <ManageMembership
          membership={{ ...base, state: 'payment_failed', graceUntil: '2026-11-14T00:00:00.000Z' }}
          onChanged={jest.fn()}
        />,
      );
      expect(getByText(/Your access continues until .*2026/)).toBeTruthy();
    });
  });

  it('should not offer Change amount when the interval is unknown, since the minimum depends on it', () => {
    const { queryByText, getByText } = render(
      <ManageMembership membership={{ ...base, interval: null }} onChanged={jest.fn()} />,
    );
    expect(queryByText('Change amount')).toBeNull();
    expect(getByText('Update payment method')).toBeTruthy();
    expect(getByText('Cancel membership')).toBeTruthy();
  });
});
