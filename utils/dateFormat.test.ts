import { formatMonthDay, formatLongDate, formatDateRange } from './dateFormat';

describe('formatMonthDay()', () => {
  it('formats English as "Month Nth"', () => {
    expect(formatMonthDay(new Date(2019, 9, 6), 'en')).toBe('October 6th');
    expect(formatMonthDay(new Date(2025, 3, 18), 'en')).toBe('April 18th');
  });

  it('uses the right English ordinal suffix', () => {
    expect(formatMonthDay(new Date(2025, 0, 1), 'en')).toBe('January 1st');
    expect(formatMonthDay(new Date(2025, 0, 2), 'en')).toBe('January 2nd');
    expect(formatMonthDay(new Date(2025, 0, 3), 'en')).toBe('January 3rd');
    expect(formatMonthDay(new Date(2025, 0, 11), 'en')).toBe('January 11th');
    expect(formatMonthDay(new Date(2025, 0, 21), 'en')).toBe('January 21st');
    expect(formatMonthDay(new Date(2025, 0, 23), 'en')).toBe('January 23rd');
  });

  // The bug: Portuguese session headers rendered "OCTOBER 6TH" — an English
  // month name plus an English ordinal, neither of which exists in Portuguese.
  it('formats Portuguese as "N de mês", with no English ordinal', () => {
    expect(formatMonthDay(new Date(2019, 9, 6), 'pt')).toBe('6 de outubro');
    expect(formatMonthDay(new Date(2025, 3, 18), 'pt')).toBe('18 de abril');
  });

  it('never leaks an English ordinal or month name into Portuguese', () => {
    for (let day = 1; day <= 28; day++) {
      const label = formatMonthDay(new Date(2025, 0, day), 'pt');
      expect(label).not.toMatch(/\d(st|nd|rd|th)\b/);
      expect(label).not.toMatch(/January/i);
    }
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatMonthDay(new Date('nope'), 'en')).toBe('');
    expect(formatMonthDay(new Date('nope'), 'pt')).toBe('');
  });
});

describe('formatLongDate()', () => {
  it('formats English as "D Month YYYY"', () => {
    expect(formatLongDate('2025-11-12', 'en')).toBe('12 November 2025');
  });

  it('formats Portuguese as "D de mês de YYYY"', () => {
    expect(formatLongDate('2025-11-12', 'pt')).toBe('12 de novembro de 2025');
  });

  it('returns an empty string for an empty input', () => {
    expect(formatLongDate('', 'en')).toBe('');
  });
});

describe('formatDateRange()', () => {
  it('collapses a same-day range to a single date', () => {
    expect(formatDateRange('2025-04-14', '2025-04-14', 'en')).toBe('14 April 2025');
    expect(formatDateRange('2025-04-14', '2025-04-14', 'pt')).toBe('14 de abril de 2025');
  });

  it('factors out a shared month and year', () => {
    expect(formatDateRange('2025-04-14', '2025-04-15', 'en')).toBe('14–15 April 2025');
    expect(formatDateRange('2025-04-14', '2025-04-15', 'pt')).toBe('14–15 de abril de 2025');
  });

  it('factors out a shared year across months', () => {
    expect(formatDateRange('2025-04-30', '2025-05-01', 'en')).toBe('30 April – 1 May 2025');
    expect(formatDateRange('2025-04-30', '2025-05-01', 'pt')).toBe('30 de abril – 1 de maio de 2025');
  });

  it('spells both endpoints out across a year boundary', () => {
    expect(formatDateRange('2024-12-31', '2025-01-01', 'en')).toBe('31 December 2024 – 1 January 2025');
  });

  it('falls back to the start date when the end is missing or unparseable', () => {
    expect(formatDateRange('2025-04-14', undefined, 'en')).toBe('14 April 2025');
    expect(formatDateRange('2025-04-14', 'nonsense', 'en')).toBe('14 April 2025');
  });

  it('returns an empty string with no start date', () => {
    expect(formatDateRange('', '2025-04-15', 'en')).toBe('');
  });
});
