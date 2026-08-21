import { normalizeSessionType } from './retreatService';

describe('normalizeSessionType()', () => {
  it('passes through the periods the UI has labels for', () => {
    expect(normalizeSessionType('morning')).toBe('morning');
    expect(normalizeSessionType('afternoon')).toBe('afternoon');
    expect(normalizeSessionType('evening')).toBe('evening');
    expect(normalizeSessionType('full_day')).toBe('full_day');
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeSessionType('  MORNING ')).toBe('morning');
    expect(normalizeSessionType('Afternoon')).toBe('afternoon');
  });

  // time_period is untyped text with no DB constraint, and around a quarter of
  // production sessions leave it null. Anything unrecognized has to land on
  // 'other' — the session header looks the label up by key, and an unknown
  // value would have no translation to find.
  it("maps anything unrecognized to 'other'", () => {
    expect(normalizeSessionType(null)).toBe('other');
    expect(normalizeSessionType(undefined)).toBe('other');
    expect(normalizeSessionType('')).toBe('other');
    expect(normalizeSessionType('   ')).toBe('other');
    expect(normalizeSessionType('night')).toBe('other');
    expect(normalizeSessionType(42)).toBe('other');
    expect(normalizeSessionType({})).toBe('other');
  });
});
