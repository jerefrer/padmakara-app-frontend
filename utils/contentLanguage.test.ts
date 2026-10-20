import {
  defaultForEvent,
  defaultShowPortuguese,
  narrowToEvent,
  parseEventLanguages,
  parseShowPortuguese,
  serializeContentLanguages,
  showPortugueseFromLegacy,
  sortLanguageCodes,
} from './contentLanguage';

describe('sortLanguageCodes', () => {
  it('orders tib < en < pt < es < fr', () => {
    expect(sortLanguageCodes(['fr', 'pt', 'tib', 'es', 'en'])).toEqual([
      'tib',
      'en',
      'pt',
      'es',
      'fr',
    ]);
  });

  it('places unknown codes last, and dedupes', () => {
    expect(sortLanguageCodes(['de', 'en', 'de'])).toEqual(['en', 'de']);
  });
});

describe('defaultForEvent', () => {
  const TRILINGUAL = ['tib', 'en', 'pt'];

  it('shows the original plus English when Portuguese is off', () => {
    expect(defaultForEvent('tib', false, TRILINGUAL)).toEqual(['tib', 'en']);
  });

  it('adds Portuguese when the toggle is on', () => {
    expect(defaultForEvent('tib', true, TRILINGUAL)).toEqual(['tib', 'en', 'pt']);
  });

  it('does not add English twice when English is the original', () => {
    expect(defaultForEvent('en', false, ['en', 'pt'])).toEqual(['en']);
    expect(defaultForEvent('en', true, ['en', 'pt'])).toEqual(['en', 'pt']);
  });

  it('always shows a Portuguese original, even with the toggle off', () => {
    expect(defaultForEvent('pt', false, ['en', 'pt'])).toEqual(['en', 'pt']);
  });

  it('narrows to the languages the event actually has', () => {
    expect(defaultForEvent('tib', true, ['tib', 'en'])).toEqual(['tib', 'en']);
    expect(defaultForEvent('tib', false, ['tib', 'en'])).toEqual(['tib', 'en']);
  });

  it('shows the whole event when the default would leave only the original', () => {
    // Tibetan event with Portuguese but no English tracks, Portuguese off:
    // the rule alone gives ['tib'], leaving the reader nothing they follow.
    expect(defaultForEvent('tib', false, ['tib', 'pt'])).toEqual(['tib', 'pt']);
  });

  it('keeps the original alone when the event really is single-language', () => {
    expect(defaultForEvent('tib', false, ['tib'])).toEqual(['tib']);
    expect(defaultForEvent('en', false, ['en'])).toEqual(['en']);
  });

  it('falls back to the whole event when nothing in the default is present', () => {
    expect(defaultForEvent('en', false, ['es'])).toEqual(['es']);
  });

  it('returns the rule unnarrowed when the event has no language metadata', () => {
    expect(defaultForEvent('tib', false, [])).toEqual(['tib', 'en']);
  });
});

describe('parseShowPortuguese', () => {
  it('returns null when the user has never set the toggle', () => {
    expect(parseShowPortuguese(null)).toBeNull();
    expect(parseShowPortuguese('')).toBeNull();
    expect(parseShowPortuguese('maybe')).toBeNull();
  });

  it('reads the stored boolean', () => {
    expect(parseShowPortuguese('true')).toBe(true);
    expect(parseShowPortuguese('false')).toBe(false);
  });
});

describe('showPortugueseFromLegacy', () => {
  it('maps the old content-language values', () => {
    expect(showPortugueseFromLegacy('en')).toBe(false);
    expect(showPortugueseFromLegacy('pt')).toBe(true);
    expect(showPortugueseFromLegacy('en-pt')).toBe(true);
    expect(showPortugueseFromLegacy('all')).toBe(true);
  });

  it('maps a stored language array by whether it contains Portuguese', () => {
    expect(showPortugueseFromLegacy('["tib","pt"]')).toBe(true);
    expect(showPortugueseFromLegacy('["tib","en"]')).toBe(false);
  });

  it('returns null for nothing stored or an unusable value', () => {
    expect(showPortugueseFromLegacy(null)).toBeNull();
    expect(showPortugueseFromLegacy('{oops')).toBeNull();
  });
});

describe('defaultShowPortuguese', () => {
  it('is on for a Portuguese interface and off otherwise', () => {
    expect(defaultShowPortuguese('pt')).toBe(true);
    expect(defaultShowPortuguese('en')).toBe(false);
  });
});

describe('parseEventLanguages', () => {
  it('returns null when nothing is stored, so the default applies', () => {
    expect(parseEventLanguages(null)).toBeNull();
    expect(parseEventLanguages('')).toBeNull();
  });

  it('migrates a legacy single code literally', () => {
    expect(parseEventLanguages('en')).toEqual(['en']);
    expect(parseEventLanguages('tib')).toEqual(['tib']);
  });

  it('migrates the legacy sentinels to the empty set, which narrows to the whole event', () => {
    expect(parseEventLanguages('all')).toEqual([]);
    expect(parseEventLanguages('en-pt')).toEqual([]);
    expect(narrowToEvent(parseEventLanguages('all')!, ['tib', 'en'])).toEqual(['tib', 'en']);
  });

  it('reads a stored JSON array and round-trips it', () => {
    expect(parseEventLanguages('["pt","tib"]')).toEqual(['tib', 'pt']);
    expect(parseEventLanguages(serializeContentLanguages(['pt', 'tib']))).toEqual(['tib', 'pt']);
  });

  it('returns null for malformed or empty stored values', () => {
    expect(parseEventLanguages('{oops')).toBeNull();
    expect(parseEventLanguages('[]')).toBeNull();
    expect(parseEventLanguages('[1,2]')).toBeNull();
  });
});

describe('narrowToEvent', () => {
  it('intersects the selection with the languages the event has', () => {
    expect(narrowToEvent(['tib', 'en'], ['tib', 'en', 'pt'])).toEqual(['tib', 'en']);
  });

  it('returns every event language when the intersection is empty', () => {
    expect(narrowToEvent(['pt'], ['tib', 'en'])).toEqual(['tib', 'en']);
  });

  it('returns the selection unchanged when the event has no language metadata', () => {
    expect(narrowToEvent(['tib', 'en'], [])).toEqual(['tib', 'en']);
  });
});
