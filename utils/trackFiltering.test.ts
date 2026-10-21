import { sortTracksForSession } from './trackFiltering';
import { defaultForEvent } from './contentLanguage';
import {
  filterTracksByLanguage,
  resolveEventOriginalLanguage,
  getEventLanguages,
  trackLanguages,
} from './trackFiltering';
import type { TrackWithSession } from './trackFiltering';
import type { Track } from '@/types';

/** Every language used across this file's fixtures. */
const ALL = ['tib', 'en', 'pt'];

const baseTrack = (overrides: Partial<Track>): Track => ({
  id: overrides.id || 't',
  title: 'Track',
  duration: 100,
  order: 0,
  session_id: 's',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('sortTracksForSession', () => {
  it('B1 — sorts by `order` ascending', () => {
    const tracks = [baseTrack({ id: 'a', order: 1 }), baseTrack({ id: 'b', order: 0 })];
    expect(sortTracksForSession(tracks).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('B2 — same order: isOriginal true comes first', () => {
    const tracks = [
      baseTrack({ id: 'translation', order: 0, isOriginal: false }),
      baseTrack({ id: 'original', order: 0, isOriginal: true }),
    ];
    expect(sortTracksForSession(tracks).map((t) => t.id)).toEqual(['original', 'translation']);
  });

  it('B3 — same order, both original: en sorts before pt', () => {
    const tracks = [
      baseTrack({ id: 'pt', order: 0, isOriginal: true, originalLanguage: 'pt' }),
      baseTrack({ id: 'en', order: 0, isOriginal: true, originalLanguage: 'en' }),
    ];
    expect(sortTracksForSession(tracks).map((t) => t.id)).toEqual(['en', 'pt']);
  });

  it('B4 — language order is en, pt, es, fr', () => {
    const tracks = [
      baseTrack({ id: 'fr', order: 0, isOriginal: true, originalLanguage: 'fr' }),
      baseTrack({ id: 'en', order: 0, isOriginal: true, originalLanguage: 'en' }),
      baseTrack({ id: 'pt', order: 0, isOriginal: true, originalLanguage: 'pt' }),
      baseTrack({ id: 'es', order: 0, isOriginal: true, originalLanguage: 'es' }),
    ];
    expect(sortTracksForSession(tracks).map((t) => t.id)).toEqual(['en', 'pt', 'es', 'fr']);
  });

  it('B5 — unknown language sorts last', () => {
    const tracks = [
      baseTrack({ id: 'de', order: 0, isOriginal: true, originalLanguage: 'de' }),
      baseTrack({ id: 'en', order: 0, isOriginal: true, originalLanguage: 'en' }),
    ];
    expect(sortTracksForSession(tracks).map((t) => t.id)).toEqual(['en', 'de']);
  });

  it('B6 — track without originalLanguage or language is treated as en', () => {
    const tracks = [
      baseTrack({ id: 'no-lang', order: 0, isOriginal: true }),
      baseTrack({ id: 'pt', order: 0, isOriginal: true, originalLanguage: 'pt' }),
    ];
    expect(sortTracksForSession(tracks).map((t) => t.id)).toEqual(['no-lang', 'pt']);
  });
});

const tws = (overrides: Partial<TrackWithSession>): TrackWithSession => ({
  ...baseTrack(overrides),
  sessionId: overrides.sessionId || 's1',
  sessionName: overrides.sessionName || 'Session 1',
  sessionDate: overrides.sessionDate || '2026-01-01',
  sessionType: overrides.sessionType || 'morning',
  sessionPartNumber: overrides.sessionPartNumber ?? null,
});

describe('filterTracksByLanguage', () => {
  it('A1 — no language metadata anywhere: returns all tracks regardless of mode', () => {
    const tracks = [tws({ id: 'a' }), tws({ id: 'b' })];
    expect(filterTracksByLanguage(tracks, ['en']).map((t) => t.id)).toEqual(['a', 'b']);
    expect(filterTracksByLanguage(tracks, ['pt']).map((t) => t.id)).toEqual(['a', 'b']);
    expect(filterTracksByLanguage(tracks, ALL).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('A2 — `en` mode + bilingual languages array: tracks with `en` returned', () => {
    const tracks = [
      tws({ id: 'bi1', languages: ['en', 'pt'] }),
      tws({ id: 'bi2', languages: ['en', 'pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['en']).map((t) => t.id)).toEqual(['bi1', 'bi2']);
  });

  it('A3 — `en` mode + monolingual tracks: only EN returned', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['en']).map((t) => t.id)).toEqual(['en']);
  });

  it('A4 — `pt` mode + monolingual tracks: only PT returned', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['pt']).map((t) => t.id)).toEqual(['pt']);
  });

  it('A5 — selecting every language present returns all, and preserves order', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
      tws({ id: 'es', languages: ['es'] }),
    ];
    expect(
      filterTracksByLanguage(tracks, ['en', 'pt', 'es']).map((t) => t.id),
    ).toEqual(['en', 'pt', 'es']);
  });

  it('A5b — a language the selection omits is excluded, even from a wide selection', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'es', languages: ['es'] }),
    ];
    expect(filterTracksByLanguage(tracks, ALL).map((t) => t.id)).toEqual(['en']);
  });

  it('A6 — `pt` mode but no PT tracks: fall back to all', () => {
    const tracks = [
      tws({ id: 'en1', languages: ['en'] }),
      tws({ id: 'en2', languages: ['en'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['pt']).map((t) => t.id)).toEqual(['en1', 'en2']);
  });

  it('A7 — `en` mode + no `languages` array, isOriginal true: included via fallback', () => {
    const tracks = [
      tws({ id: 'orig', isOriginal: true, language: 'en' }),
    ];
    expect(filterTracksByLanguage(tracks, ['en']).map((t) => t.id)).toEqual(['orig']);
  });

  it('A8 — `en` mode + no `languages` array, isOriginal false: excluded by fallback', () => {
    const tracks = [
      tws({ id: 'orig', isOriginal: true, language: 'en' }),
      tws({ id: 'translation', isOriginal: false, language: 'pt' }),
    ];
    expect(filterTracksByLanguage(tracks, ['en']).map((t) => t.id)).toEqual(['orig']);
  });

  it('A9 — `pt` mode + no `languages` array, isOriginal false, language pt: included via fallback', () => {
    const tracks = [
      tws({ id: 'orig-en', isOriginal: true, language: 'en' }),
      tws({ id: 'pt-translation', isOriginal: false, language: 'pt' }),
    ];
    expect(filterTracksByLanguage(tracks, ['pt']).map((t) => t.id)).toEqual(['pt-translation']);
  });

  it('A10 — `pt` mode + no `languages`, isOriginal false, language es: excluded', () => {
    const tracks = [
      tws({ id: 'pt', isOriginal: false, language: 'pt' }),
      tws({ id: 'es', isOriginal: false, language: 'es' }),
    ];
    expect(filterTracksByLanguage(tracks, ['pt']).map((t) => t.id)).toEqual(['pt']);
  });

  it('A11 — `en` mode + Spanish-only languages array: excluded', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'es', languages: ['es'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['en']).map((t) => t.id)).toEqual(['en']);
  });

  it('A12 — empty input returns empty', () => {
    expect(filterTracksByLanguage([], ['en'])).toEqual([]);
    expect(filterTracksByLanguage([], ['pt'])).toEqual([]);
    expect(filterTracksByLanguage([], ALL)).toEqual([]);
  });

  it('A13 — selecting every language returns every track unchanged', () => {
    const tracks = [
      tws({ id: 'tib', languages: ['tib'] }),
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, ALL).map((t) => t.id)).toEqual([
      'tib',
      'en',
      'pt',
    ]);
  });

  it('A14 — `tib` filter returns Tibetan tracks (incl. bilingual TIB+ENG)', () => {
    const tracks = [
      tws({ id: 'tib-en', languages: ['tib', 'en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['tib']).map((t) => t.id)).toEqual([
      'tib-en',
    ]);
  });

  it('A15 — trilingual event (TIB+ENG set / PT set): each filter isolates its set', () => {
    const tracks = [
      tws({ id: 'tib-en', languages: ['tib', 'en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['en']).map((t) => t.id)).toEqual(['tib-en']);
    expect(filterTracksByLanguage(tracks, ['pt']).map((t) => t.id)).toEqual(['pt']);
    expect(filterTracksByLanguage(tracks, ['tib']).map((t) => t.id)).toEqual(['tib-en']);
    expect(filterTracksByLanguage(tracks, ALL).map((t) => t.id)).toEqual(['tib-en', 'pt']);
  });

  it('A17 — Tibetan + English returns the Tibetan and English tracks, not Portuguese', () => {
    const tracks = [
      tws({ id: 'tib', languages: ['tib'] }),
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['tib', 'en']).map((t) => t.id)).toEqual([
      'tib',
      'en',
    ]);
  });

  it('A18 — Tibetan + Portuguese returns the Tibetan and Portuguese tracks, not English', () => {
    const tracks = [
      tws({ id: 'tib', languages: ['tib'] }),
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, ['tib', 'pt']).map((t) => t.id)).toEqual([
      'tib',
      'pt',
    ]);
  });

  it('A19 — a bilingual TIB+ENG track is returned once, not duplicated', () => {
    const tracks = [tws({ id: 'tib-en', languages: ['tib', 'en'] })];
    expect(filterTracksByLanguage(tracks, ['tib', 'en']).map((t) => t.id)).toEqual([
      'tib-en',
    ]);
  });

  it('A20 — an empty selection returns every track rather than an empty list', () => {
    const tracks = [tws({ id: 'en', languages: ['en'] }), tws({ id: 'pt', languages: ['pt'] })];
    expect(filterTracksByLanguage(tracks, []).map((t) => t.id)).toEqual(['en', 'pt']);
  });

  it('A16 — anti-leak: a TIB-only original does NOT show in the `en` filter', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'tib', languages: ['tib'], isOriginal: true }),
    ];
    expect(filterTracksByLanguage(tracks, ['en']).map((t) => t.id)).toEqual(['en']);
  });
});

describe('trackLanguages', () => {
  it('prefers the `languages` array', () => {
    expect(trackLanguages(baseTrack({ languages: ['en', 'pt'] }))).toEqual(['en', 'pt']);
  });

  it('falls back to originalLanguage, then language', () => {
    expect(trackLanguages(baseTrack({ originalLanguage: 'tib' }))).toEqual(['tib']);
    expect(trackLanguages(baseTrack({ language: 'pt' }))).toEqual(['pt']);
  });

  it('returns [] when no language metadata is present', () => {
    expect(trackLanguages(baseTrack({}))).toEqual([]);
  });
});

describe('getEventLanguages', () => {
  it('returns the distinct languages present, ordered tib < en < pt', () => {
    const tracks = [
      tws({ id: 'pt', languages: ['pt'] }),
      tws({ id: 'tib-en', languages: ['tib', 'en'] }),
      tws({ id: 'en2', languages: ['en'] }),
    ];
    expect(getEventLanguages(tracks)).toEqual(['tib', 'en', 'pt']);
  });

  it('returns a single language for a monolingual event', () => {
    const tracks = [tws({ id: 'a', languages: ['en'] }), tws({ id: 'b', languages: ['en'] })];
    expect(getEventLanguages(tracks)).toEqual(['en']);
  });

  it('returns [] when no track carries language metadata', () => {
    expect(getEventLanguages([tws({ id: 'a' }), tws({ id: 'b' })])).toEqual([]);
  });

  it('places unknown language codes last', () => {
    const tracks = [
      tws({ id: 'de', languages: ['de'] }),
      tws({ id: 'en', languages: ['en'] }),
    ];
    expect(getEventLanguages(tracks)).toEqual(['en', 'de']);
  });
});

// Event 920 (a Tibetan teaching translated into English), as the API returns it.
const event920Tracks = [
  baseTrack({ id: '1', order: 1, originalLanguage: 'tib', languages: ['tib'], isOriginal: true }),
  baseTrack({ id: '2', order: 2, originalLanguage: 'tib', languages: ['tib', 'en'], isOriginal: true }),
  baseTrack({ id: '3en', order: 3, originalLanguage: 'en', languages: ['en'], isOriginal: false }),
  baseTrack({ id: '3tib', order: 3, originalLanguage: 'tib', languages: ['tib'], isOriginal: true }),
  baseTrack({ id: '5en', order: 5, originalLanguage: 'en', languages: ['en'], isOriginal: false }),
  baseTrack({ id: '5tib', order: 5, originalLanguage: 'tib', languages: ['tib'], isOriginal: true }),
];

describe('resolveEventOriginalLanguage', () => {
  it('should use the declared language when the event has one', () => {
    expect(resolveEventOriginalLanguage('tib', [])).toBe('tib');
    expect(resolveEventOriginalLanguage('en', event920Tracks)).toBe('en');
  });

  it('should infer the language from the untranslated tracks when the event declares none', () => {
    // A copy cached before the API sent `originalLanguage` has no such field.
    expect(resolveEventOriginalLanguage(undefined, event920Tracks)).toBe('tib');
  });

  it('should show the Tibetan tracks by default for an event cached without a declared language', () => {
    const original = resolveEventOriginalLanguage(undefined, event920Tracks);
    const shown = filterTracksByLanguage(
      event920Tracks.map((t) => ({ ...t, sessionId: 's', sessionName: '', sessionDate: '', sessionType: 'morning' })),
      defaultForEvent(original, false, getEventLanguages(event920Tracks)),
    );
    expect(shown.map((t) => t.id)).toEqual(['1', '2', '3en', '3tib', '5en', '5tib']);
  });

  it('should fall back to English when nothing says otherwise', () => {
    expect(resolveEventOriginalLanguage(undefined, [])).toBe('en');
    expect(resolveEventOriginalLanguage(undefined, [baseTrack({ id: 'x' })])).toBe('en');
  });

  it('should prefer the most common untranslated language and break ties by language order', () => {
    const fr = (id: string) => baseTrack({ id, originalLanguage: 'fr', isOriginal: true });
    const en = (id: string) => baseTrack({ id, originalLanguage: 'en', isOriginal: true });
    expect(resolveEventOriginalLanguage(undefined, [fr('a'), fr('b'), en('c')])).toBe('fr');
    expect(resolveEventOriginalLanguage(undefined, [fr('a'), en('c')])).toBe('en');
  });
});
