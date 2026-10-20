import en from '../../locales/en.json';
import pt from '../../locales/pt.json';
import { getLanguageShortLabel } from '../../components/LanguageCheckboxList';
import { eventLanguages } from '../../utils/eventLanguages';

/** A t() that resolves dotted keys against one locale file, '' when missing. */
function translatorFor(locale: unknown) {
  return (key: string): string => {
    const value = key.split('.').reduce<unknown>(
      (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
      locale,
    );
    return typeof value === 'string' ? value : '';
  };
}

describe('getLanguageShortLabel', () => {
  it('should abbreviate English as ING when the interface is in Portuguese', () => {
    expect(getLanguageShortLabel('en', translatorFor(pt))).toBe('ING');
  });

  it('should abbreviate English as EN when the interface is in English', () => {
    expect(getLanguageShortLabel('en', translatorFor(en))).toBe('EN');
  });

  it('should abbreviate Tibetan as TIB in both interfaces', () => {
    expect(getLanguageShortLabel('tib', translatorFor(pt))).toBe('TIB');
    expect(getLanguageShortLabel('tib', translatorFor(en))).toBe('TIB');
  });

  it('should fall back to the upper-cased code when no abbreviation is defined', () => {
    expect(getLanguageShortLabel('de', translatorFor(pt))).toBe('DE');
  });
});

describe('eventLanguages', () => {

  // Partial on purpose: eventLanguages only reads sessions[].tracks[] languages.
  const event = {
    sessions: [
      { tracks: [{ languages: ['tib', 'en'] }, { originalLanguage: 'pt' }, { languages: ['bo'] }] },
    ],
  };

  it('should read "Tib + Ing + Por" when the interface is in Portuguese', () => {
    expect(eventLanguages(event as never, translatorFor(pt)).join(' + ')).toBe('Tib + Ing + Por');
  });

  it('should read "Tib + En + Pt" when the interface is in English', () => {
    expect(eventLanguages(event as never, translatorFor(en)).join(' + ')).toBe('Tib + En + Pt');
  });
});
