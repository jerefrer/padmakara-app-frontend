import { pickPreferredSubtitle } from './subtitlePreference';

const en = { language: 'en', label: 'English' };
const pt = { language: 'pt', label: 'Português' };
const enUS = { language: 'en-US', label: 'English (US)' };

describe('pickPreferredSubtitle()', () => {
  it('returns null when there are no tracks', () => {
    expect(pickPreferredSubtitle([], 'en', 'en')).toBeNull();
  });

  it('prefers the content language when it is available', () => {
    expect(pickPreferredSubtitle([en, pt], 'pt', 'en')).toBe(pt);
    expect(pickPreferredSubtitle([en, pt], 'en', 'pt')).toBe(en);
  });

  it('for bilingual "en-pt", follows the UI language', () => {
    expect(pickPreferredSubtitle([en, pt], 'en-pt', 'pt')).toBe(pt);
    expect(pickPreferredSubtitle([en, pt], 'en-pt', 'en')).toBe(en);
  });

  it('matches regional variants loosely via startsWith', () => {
    expect(pickPreferredSubtitle([enUS, pt], 'en', 'en')).toBe(enUS);
  });

  it('falls back to the preferred order when the content language is absent', () => {
    // Content language is pt but only en is offered → order ['pt','en'] → en.
    expect(pickPreferredSubtitle([en], 'pt', 'pt')).toBe(en);
  });

  it('falls back to the first track when no preference matches', () => {
    const de = { language: 'de', label: 'Deutsch' };
    const fr = { language: 'fr', label: 'Français' };
    expect(pickPreferredSubtitle([de, fr], 'en', 'en')).toBe(de);
  });
});
