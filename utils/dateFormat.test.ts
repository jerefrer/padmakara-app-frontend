import { formatMonthDay } from './dateFormat';

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
