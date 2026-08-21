import type { Language } from '@/utils/i18n';

/** English ordinal suffix: 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format a date as a month-and-day label in the UI language:
 *   en → "October 6th"
 *   pt → "6 de outubro"
 *
 * Portuguese writes calendar days as plain cardinals and lowercases month
 * names, so the English ordinal form must never leak into the pt string.
 * Returns '' for an unparseable date so callers can drop the segment.
 */
export function formatMonthDay(date: Date, language: Language): string {
  if (isNaN(date.getTime())) return '';
  const isPt = language === 'pt';
  const month = date.toLocaleDateString(isPt ? 'pt-PT' : 'en-US', { month: 'long' });
  const day = date.getDate();
  return isPt ? `${day} de ${month}` : `${month} ${ordinal(day)}`;
}

/** Format an ISO date as "12 November 2025" / "12 de novembro de 2025". */
export function formatLongDate(dateStr: string, language: Language): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a start/end date pair as a compact range, factoring out whatever the
 * two endpoints share:
 *   - same day:              "14 April 2025"        (one-day event)
 *   - same month & year:     "14–15 April 2025"
 *   - same year, diff month: "30 April – 1 May 2025"
 *   - different year:        "31 December 2024 – 1 January 2025"
 * Portuguese uses the "14 de abril de 2025" glue. Day/month/year are read via
 * the local-timezone getters so the pieces stay consistent with what
 * formatLongDate renders. Falls back to a single date when endStr is missing,
 * unparseable, or equal to startStr.
 */
export function formatDateRange(startStr: string, endStr: string | undefined, language: Language): string {
  if (!startStr) return '';
  if (!endStr) return formatLongDate(startStr, language);

  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return formatLongDate(startStr, language);
  }

  const isPt = language === 'pt';
  const locale = isPt ? 'pt-PT' : 'en-GB';
  const monthName = (d: Date) => d.toLocaleDateString(locale, { month: 'long' });

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const sameDay = sameMonth && start.getDate() === end.getDate();

  if (sameDay) return formatLongDate(startStr, language);

  const d1 = start.getDate();
  const d2 = end.getDate();
  const m1 = monthName(start);
  const m2 = monthName(end);
  const y1 = start.getFullYear();

  if (sameMonth) {
    // "14–15 April 2025" / "14–15 de abril de 2025"
    return isPt ? `${d1}–${d2} de ${m1} de ${y1}` : `${d1}–${d2} ${m1} ${y1}`;
  }
  if (sameYear) {
    // "30 April – 1 May 2025" / "30 de abril – 1 de maio de 2025"
    return isPt
      ? `${d1} de ${m1} – ${d2} de ${m2} de ${y1}`
      : `${d1} ${m1} – ${d2} ${m2} ${y1}`;
  }
  // Different year — spell both endpoints out in full.
  return `${formatLongDate(startStr, language)} – ${formatLongDate(endStr, language)}`;
}
