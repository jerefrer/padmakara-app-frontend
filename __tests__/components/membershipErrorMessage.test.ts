import { membershipErrorMessage } from '@/components/membership/errorMessage';

const t = () => undefined;

describe('membershipErrorMessage', () => {
  it.each([
    ['NOT_EASYPAY_MEMBER', 'This membership is not paid by card or Direct Debit, so it cannot be changed here. Please contact us.'],
    ['NOT_CANCELLED', 'This membership is not cancelled.'],
    ['ACCESS_ENDED', 'Your membership has ended. Please join again.'],
    ['MEMBERSHIP_PROCESSING', 'Your first payment is still being processed.'],
    ['EASYPAY_UNAVAILABLE', 'We could not reach the payment provider. Nothing was changed. Please try again later.'],
  ])('should map %s to its localized message', (code, expected) => {
    expect(membershipErrorMessage(t, code)).toBe(expected);
  });

  it('should give the range message for INVALID_CONTRIBUTION when the range is known', () => {
    expect(membershipErrorMessage(t, 'INVALID_CONTRIBUTION', { min: '€5', max: '€1000' })).toBe(
      'The amount must be between €5 and €1000.',
    );
  });

  it('should give the generic message when the code is unknown or missing', () => {
    expect(membershipErrorMessage(t, 'SOMETHING_NEW')).toBe('Something went wrong. Please try again.');
    expect(membershipErrorMessage(t, undefined)).toBe('Something went wrong. Please try again.');
  });

  it('should use the translation when the locale has one', () => {
    const pt = (key: string) => (key === 'membership.errAccessEnded' ? 'A sua adesão terminou.' : undefined);
    expect(membershipErrorMessage(pt, 'ACCESS_ENDED')).toBe('A sua adesão terminou.');
  });
});
