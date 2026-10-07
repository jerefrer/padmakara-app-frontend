import { formatLongDate } from '@/utils/dateFormat';
import { tr } from './tr';

type T = (key: string, params?: Record<string, unknown>) => string | undefined;

/** One-line membership state shared by the Settings card and the Settings row. */
export function membershipStatusLine(
  t: T,
  lang: 'en' | 'pt',
  hasActiveSubscription: boolean,
  sub: { cancelledAt?: string | null; expiresAt?: string | null } | null | undefined,
): string {
  const endsOn = sub?.cancelledAt && sub.expiresAt ? sub.expiresAt : null;
  if (!hasActiveSubscription) return tr(t, 'statusNone', 'No active membership');
  if (endsOn) return tr(t, 'statusEnds', 'Ends {{date}}', { date: formatLongDate(endsOn, lang) });
  return tr(t, 'statusActive', 'Active');
}
