import { sortTracksForSession } from './trackFiltering';
import { filterTracksByLanguage } from './trackFiltering';
import type { TrackWithSession } from './trackFiltering';
import type { Track } from '@/types';

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
    expect(filterTracksByLanguage(tracks, 'en').map((t) => t.id)).toEqual(['a', 'b']);
    expect(filterTracksByLanguage(tracks, 'pt').map((t) => t.id)).toEqual(['a', 'b']);
    expect(filterTracksByLanguage(tracks, 'en-pt').map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('A2 — `en` mode + bilingual languages array: tracks with `en` returned', () => {
    const tracks = [
      tws({ id: 'bi1', languages: ['en', 'pt'] }),
      tws({ id: 'bi2', languages: ['en', 'pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, 'en').map((t) => t.id)).toEqual(['bi1', 'bi2']);
  });

  it('A3 — `en` mode + monolingual tracks: only EN returned', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, 'en').map((t) => t.id)).toEqual(['en']);
  });

  it('A4 — `pt` mode + monolingual tracks: only PT returned', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
    ];
    expect(filterTracksByLanguage(tracks, 'pt').map((t) => t.id)).toEqual(['pt']);
  });

  it('A5 — `en-pt` mode: no filter, returns all', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'pt', languages: ['pt'] }),
      tws({ id: 'es', languages: ['es'] }),
    ];
    expect(filterTracksByLanguage(tracks, 'en-pt').map((t) => t.id)).toEqual(['en', 'pt', 'es']);
  });

  it('A6 — `pt` mode but no PT tracks: fall back to all', () => {
    const tracks = [
      tws({ id: 'en1', languages: ['en'] }),
      tws({ id: 'en2', languages: ['en'] }),
    ];
    expect(filterTracksByLanguage(tracks, 'pt').map((t) => t.id)).toEqual(['en1', 'en2']);
  });

  it('A7 — `en` mode + no `languages` array, isOriginal true: included via fallback', () => {
    const tracks = [
      tws({ id: 'orig', isOriginal: true, language: 'en' }),
    ];
    expect(filterTracksByLanguage(tracks, 'en').map((t) => t.id)).toEqual(['orig']);
  });

  it('A8 — `en` mode + no `languages` array, isOriginal false: excluded by fallback', () => {
    const tracks = [
      tws({ id: 'orig', isOriginal: true, language: 'en' }),
      tws({ id: 'translation', isOriginal: false, language: 'pt' }),
    ];
    expect(filterTracksByLanguage(tracks, 'en').map((t) => t.id)).toEqual(['orig']);
  });

  it('A9 — `pt` mode + no `languages` array, isOriginal false, language pt: included via fallback', () => {
    const tracks = [
      tws({ id: 'orig-en', isOriginal: true, language: 'en' }),
      tws({ id: 'pt-translation', isOriginal: false, language: 'pt' }),
    ];
    expect(filterTracksByLanguage(tracks, 'pt').map((t) => t.id)).toEqual(['pt-translation']);
  });

  it('A10 — `pt` mode + no `languages`, isOriginal false, language es: excluded', () => {
    const tracks = [
      tws({ id: 'pt', isOriginal: false, language: 'pt' }),
      tws({ id: 'es', isOriginal: false, language: 'es' }),
    ];
    expect(filterTracksByLanguage(tracks, 'pt').map((t) => t.id)).toEqual(['pt']);
  });

  it('A11 — `en` mode + Spanish-only languages array: excluded', () => {
    const tracks = [
      tws({ id: 'en', languages: ['en'] }),
      tws({ id: 'es', languages: ['es'] }),
    ];
    expect(filterTracksByLanguage(tracks, 'en').map((t) => t.id)).toEqual(['en']);
  });

  it('A12 — empty input returns empty', () => {
    expect(filterTracksByLanguage([], 'en')).toEqual([]);
    expect(filterTracksByLanguage([], 'pt')).toEqual([]);
    expect(filterTracksByLanguage([], 'en-pt')).toEqual([]);
  });
});
