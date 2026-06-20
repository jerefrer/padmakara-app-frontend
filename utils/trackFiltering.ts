import type { Track } from '@/types';

// Tibetan is the source language for many teachings and sorts first, then the
// translations (English, Portuguese, …). Unknown codes sort last via `?? 99`.
const LANG_ORDER: Record<string, number> = { tib: 0, en: 1, pt: 2, es: 3, fr: 4 };

/**
 * Resolve the language codes a track is tagged with.
 *
 * Prefers the modern `languages` array (e.g. `['en','pt']` for a bilingual
 * file). Falls back to the single `originalLanguage`/`language` field for
 * legacy tracks. Returns `[]` when a track carries no language metadata at all.
 */
export function trackLanguages(track: Track): string[] {
  if (track.languages && track.languages.length > 0) return track.languages;
  const single = track.originalLanguage || track.language;
  return single ? [single] : [];
}

/**
 * Per-session sort: by `order` ascending, then `isOriginal` first,
 * then by language order (tib < en < pt < es < fr; unknown sorts last).
 *
 * Behavior must match the inline logic that previously lived in
 * `app/(tabs)/(groups)/retreat/[id].tsx`. Do not change semantics
 * without updating the test matrix in the spec.
 */
export function sortTracksForSession(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const aOrig = a.isOriginal ? 0 : 1;
    const bOrig = b.isOriginal ? 0 : 1;
    if (aOrig !== bOrig) return aOrig - bOrig;
    const aLang = LANG_ORDER[a.originalLanguage || a.language || 'en'] ?? 99;
    const bLang = LANG_ORDER[b.originalLanguage || b.language || 'en'] ?? 99;
    return aLang - bLang;
  });
}

/**
 * A content-language filter token: either the sentinel `'all'` (show every
 * track) or a specific language code present in the event (`'en'`, `'pt'`,
 * `'tib'`, …). The legacy `'en-pt'` value is accepted as an alias for `'all'`
 * so previously-persisted preferences keep working.
 */
export type ContentLanguageMode = string;

export const ALL_LANGUAGES = 'all';

export interface TrackWithSession extends Track {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionType: string;
  sessionPartNumber?: number | null;
}

/**
 * The distinct language codes present across a list of tracks, ordered
 * tib → en → pt → es → fr (unknown codes last). Used to build the per-event
 * language picker dynamically: a single-language event needs no picker, a
 * trilingual KPS event offers Tibetan / English / Portuguese.
 */
export function getEventLanguages(tracks: Track[]): string[] {
  const present = new Set<string>();
  for (const t of tracks) {
    for (const lang of trackLanguages(t)) present.add(lang);
  }
  return [...present].sort(
    (a, b) => (LANG_ORDER[a] ?? 99) - (LANG_ORDER[b] ?? 99),
  );
}

/**
 * Apply the user's content-language preference to a flat track list.
 *
 * - `'all'` (or the legacy `'en-pt'` alias) returns every track unchanged.
 * - A specific language code returns the tracks tagged with that language.
 *   A track is matched against its `languages` array (falling back to the
 *   single `originalLanguage`/`language` field) — there is no longer an
 *   `isOriginal`-based fallback, so a Tibetan or Portuguese-only original no
 *   longer leaks into the "English" filter.
 * - As a safety net, if a specific-language filter matches nothing we return
 *   all tracks rather than an empty screen. In practice the picker only ever
 *   offers languages that are actually present, so this rarely triggers.
 */
export function filterTracksByLanguage(
  tracks: TrackWithSession[],
  mode: ContentLanguageMode,
): TrackWithSession[] {
  if (tracks.length === 0) return [];
  if (mode === ALL_LANGUAGES || mode === 'en-pt') return tracks;

  const filtered = tracks.filter((t) => trackLanguages(t).includes(mode));
  return filtered.length === 0 ? tracks : filtered;
}
