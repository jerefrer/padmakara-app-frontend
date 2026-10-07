import { tr } from './tr';

type T = (key: string, params?: Record<string, unknown>) => string | undefined;

/** Error codes the payment API returns, mapped to `membership.*` keys with English fallbacks. */
const BY_CODE: Record<string, readonly [string, string]> = {
  NOT_EASYPAY_MEMBER: [
    'errNotEasypayMember',
    'This membership is not paid by card or Direct Debit, so it cannot be changed here. Please contact us.',
  ],
  NOT_CANCELLED: ['errNotCancelled', 'This membership is not cancelled.'],
  ACCESS_ENDED: ['errAccessEnded', 'Your membership has ended. Please join again.'],
  EASYPAY_UNAVAILABLE: [
    'errEasypayUnavailable',
    'We could not reach the payment provider. Nothing was changed. Please try again later.',
  ],
};

/**
 * What to show when a membership call fails. Always a localized string chosen from the
 * error `code`, never the server's own text: that text is English and was not written
 * for members to read.
 */
export function membershipErrorMessage(
  t: T,
  code: string | undefined,
  range?: { min: string; max: string },
): string {
  if (code === 'INVALID_CONTRIBUTION' && range) {
    return tr(t, 'errInvalidContribution', 'The amount must be between {{min}} and {{max}}.', range);
  }
  const known = code ? BY_CODE[code] : undefined;
  if (known) return tr(t, known[0], known[1]);
  return tr(t, 'errGeneric', 'Something went wrong. Please try again.');
}
