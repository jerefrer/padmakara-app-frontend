import { formatMonthDay } from '@/utils/dateFormat';
import type { Language } from '@/utils/i18n';

export interface SessionHeaderInput {
  sessionName: string;
  sessionDate: string;
  sessionType: string;
  sessionPartNumber?: number | null;
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Build the header shown above a session's tracks:
 *   en → "Day 1 · April 18th · Morning · Part 1"
 *   pt → "Dia 1 · 18 de abril · Manhã · Parte 1"
 *
 * Every segment is optional and drops out when it doesn't apply — an undated
 * session has no day or date, a single-part session has no part number, and a
 * session whose time period the API left null has no period label. When
 * nothing resolves at all, falls back to the raw session name.
 *
 * `retreatStartDate` anchors the day counter. Without it the counter is
 * relative to the session itself, i.e. always "Day 1".
 */
export function formatSessionHeader(
  session: SessionHeaderInput,
  retreatStartDate: string | undefined,
  language: Language,
  t: Translate,
): string {
  // 'other' is what retreatService maps a null time_period to. It names no
  // real time of day, so the segment is omitted rather than labelled.
  const periodLabel = session.sessionType === 'other' ? '' : t(`retreats.${session.sessionType}`);

  const partLabel = session.sessionPartNumber
    ? `${t('retreats.part') || 'Part'} ${session.sessionPartNumber}`
    : '';

  const sessionDate = new Date(session.sessionDate);
  // '' when the session has no parseable date, which also suppresses the day counter.
  const dateLabel = formatMonthDay(sessionDate, language);

  let dayLabel = '';
  const anchor = retreatStartDate ? new Date(retreatStartDate) : sessionDate;
  if (dateLabel && !isNaN(anchor.getTime())) {
    const diffDays = Math.floor((sessionDate.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
    dayLabel = t('retreats.dayNumber', { n: diffDays + 1 });
  }

  return [dayLabel, dateLabel, periodLabel, partLabel].filter(Boolean).join(' · ')
    || session.sessionName
    || '';
}
