import { formatDateRangePretty } from './retreatDates';

describe('formatDateRangePretty', () => {
  it('should put the year after a same-month range in English', () => {
    expect(formatDateRangePretty('2026-09-10', '2026-09-12', 'en')).toBe('September 10th–12th, 2026');
  });

  it('should put the year after a same-month range in Portuguese', () => {
    expect(formatDateRangePretty('2026-09-22', '2026-09-24', 'pt')).toBe('22–24 de setembro de 2026');
  });

  it('should give a single day its year', () => {
    expect(formatDateRangePretty('2025-04-18', '2025-04-18', 'en')).toBe('April 18th, 2025');
    expect(formatDateRangePretty('2025-04-18', '2025-04-18', 'pt')).toBe('18 de abril de 2025');
  });

  it('should name both months when a range crosses months', () => {
    expect(formatDateRangePretty('2024-04-01', '2024-05-03', 'en')).toBe('April 1st – May 3rd, 2024');
    expect(formatDateRangePretty('2024-04-01', '2024-05-03', 'pt')).toBe('1 de abril – 3 de maio de 2024');
  });

  it('should name both years when a range crosses the new year', () => {
    expect(formatDateRangePretty('2008-12-30', '2009-01-02', 'en')).toBe(
      'December 30th, 2008 – January 2nd, 2009',
    );
  });

  it('should return the raw text when the date is invalid', () => {
    expect(formatDateRangePretty('nonsense', 'nonsense', 'en')).toBe('nonsense');
  });
});
