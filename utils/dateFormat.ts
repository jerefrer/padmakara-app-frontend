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
