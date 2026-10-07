import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

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

  it('should show an inline error when cancelling fails', async () => {
    svc.cancel.mockResolvedValue({ success: false, error: 'Easypay is down' });
    const onChanged = jest.fn();
    const { getByText, getAllByText } = render(<ManageMembership membership={base} onChanged={onChanged} />);
    fireEvent.press(getByText('Cancel membership'));
    fireEvent.press(getAllByText('Cancel membership')[1]);
    await waitFor(() => expect(getByText('Easypay is down')).toBeTruthy());
    expect(onChanged).not.toHaveBeenCalled();
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
});
