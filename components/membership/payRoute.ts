import type { CheckoutStart } from '@/services/membershipService';
import type { MembershipInterval } from '@/utils/membership';

/** Everything the pay screen needs lives in the URL, so a browser reload keeps working. */
export function payHref(
  start: Pick<CheckoutStart, 'checkout' | 'testing'>,
  extra: { amount?: number | null; interval?: MembershipInterval | null; mode?: 'update' },
): string {
  const parts = [`id=${encodeURIComponent(start.checkout.id)}`, `session=${encodeURIComponent(start.checkout.session)}`];
  if (extra.amount != null) parts.push(`amount=${extra.amount}`);
  if (extra.interval) parts.push(`interval=${extra.interval}`);
  if (extra.mode) parts.push(`mode=${extra.mode}`);
  parts.push(`testing=${start.testing ? 1 : 0}`);
  return `/membership/pay?${parts.join('&')}`;
}
