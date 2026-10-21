import {
  parseSubtitleChoice,
  pickPreferredSubtitle,
  resolveSubtitleLanguage,
  subtitleChoiceOrder,
} from './subtitlePreference';

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

describe('parseSubtitleChoice()', () => {
  it('should return null when nothing usable is stored', () => {
    expect(parseSubtitleChoice(null)).toBeNull();
    expect(parseSubtitleChoice('')).toBeNull();
    expect(parseSubtitleChoice('de')).toBeNull();
  });

  it('should accept the four languages and "off"', () => {
    for (const code of ['en', 'pt', 'fr', 'es', 'off']) {
      expect(parseSubtitleChoice(code)).toBe(code);
    }
  });
});

describe('resolveSubtitleLanguage()', () => {
  it('should follow the interface language when the user never chose', () => {
    expect(resolveSubtitleLanguage(null, 'pt')).toBe('pt');
    expect(resolveSubtitleLanguage(null, 'en')).toBe('en');
  });

  it('should use the stored language over the interface language', () => {
    expect(resolveSubtitleLanguage('fr', 'pt')).toBe('fr');
  });

  it('should return null when subtitles are switched off', () => {
    expect(resolveSubtitleLanguage('off', 'en')).toBeNull();
  });
});

describe('subtitleChoiceOrder()', () => {
  it('should list the interface language first, then the others, then off', () => {
    expect(subtitleChoiceOrder('en')).toEqual(['en', 'pt', 'fr', 'es', 'off']);
    expect(subtitleChoiceOrder('pt')).toEqual(['pt', 'en', 'fr', 'es', 'off']);
  });
});
