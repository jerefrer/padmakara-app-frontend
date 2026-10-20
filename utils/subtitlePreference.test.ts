import { pickPreferredSubtitle } from './subtitlePreference';

const en = { language: 'en', label: 'English' };
const pt = { language: 'pt', label: 'Português' };
const enUS = { language: 'en-US', label: 'English (US)' };

describe('pickPreferredSubtitle()', () => {
  it('returns null when there are no tracks', () => {
    expect(pickPreferredSubtitle([], 'en')).toBeNull();
  });

  it('prefers the given language when it is available', () => {
    expect(pickPreferredSubtitle([en, pt], 'pt')).toBe(pt);
    expect(pickPreferredSubtitle([en, pt], 'en')).toBe(en);
  });

  it('matches regional variants loosely via startsWith', () => {
    expect(pickPreferredSubtitle([enUS, pt], 'en')).toBe(enUS);
  });

  it('falls back to the other supported language when the preferred one is absent', () => {
    expect(pickPreferredSubtitle([en], 'pt')).toBe(en);
    expect(pickPreferredSubtitle([pt], 'en')).toBe(pt);
  });

  it('falls back to the first track when nothing matches', () => {
    const de = { language: 'de', label: 'Deutsch' };
    const fr = { language: 'fr', label: 'Français' };
    expect(pickPreferredSubtitle([de, fr], 'en')).toBe(de);
  });

  it('never returns a Tibetan preference it cannot satisfy', () => {
    // Callers pass the interface language, which is never Tibetan — but if a
    // 'tib' ever arrives here, a real track still wins.
    expect(pickPreferredSubtitle([en, pt], 'tib')).toBe(en);
  });
});
