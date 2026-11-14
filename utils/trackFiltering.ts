import type { Track } from '@/types';
import { LANG_ORDER, sortLanguageCodes } from './contentLanguage';

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
 * Per-session sort: a hand-set `position` first (tracks without one
 * follow), then by `order` ascending, then `isOriginal` first, then by
 * language order (tib < en < pt < es < fr; unknown sorts last).
 *
 * Behavior must match the inline logic that previously lived in
 * `app/(tabs)/(groups)/retreat/[id].tsx`. Do not change semantics
 * without updating the test matrix in the spec.
 */
export function sortTracksForSession(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    const aPos = a.position ?? Number.POSITIVE_INFINITY;
    const bPos = b.position ?? Number.POSITIVE_INFINITY;
    if (aPos !== bPos) return aPos - bPos;
    if (a.order !== b.order) return a.order - b.order;
    const aOrig = a.isOriginal ? 0 : 1;
    const bOrig = b.isOriginal ? 0 : 1;
    if (aOrig !== bOrig) return aOrig - bOrig;
    const aLang = LANG_ORDER[a.originalLanguage || a.language || 'en'] ?? 99;
    const bLang = LANG_ORDER[b.originalLanguage || b.language || 'en'] ?? 99;
    return aLang - bLang;
  });
}

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
  return sortLanguageCodes([...present]);
}

/**
 * The language an event was taught in.
 *
 * Uses the event's own `originalLanguage` when it has one. An event copy
 * cached before the API sent that field has none, and guessing English for it
 * would hide a Tibetan teaching's Tibetan tracks — so infer it from the tracks
 * that are not translations instead: the most common language among them,
 * ties going to the earlier in tib → en → pt → es → fr. English only when the
 * tracks say nothing.
 */
export function resolveEventOriginalLanguage(
  declared: string | undefined,
  tracks: Track[],
): string {
  if (declared) return declared;

  const counts = new Map<string, number>();
  for (const track of tracks) {
    if (track.isOriginal !== true) continue;
    const code = track.originalLanguage || track.language;
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort(
    ([a, countA], [b, countB]) =>
      countB - countA || (LANG_ORDER[a] ?? 99) - (LANG_ORDER[b] ?? 99),
  );
  return ranked[0]?.[0] ?? 'en';
}

/**
 * Apply the user's content-language selection to a flat track list.
 *
 * A track is kept when any of its languages is selected — matched against its
 * `languages` array, falling back to the single `originalLanguage`/`language`
 * field. A track none of whose languages the picker offers (see
 * `getFilterableLanguages`) is always kept: no box could ever bring it back. There is no `isOriginal`-based fallback, so a Tibetan or
 * Portuguese-only original does not leak into an English-only selection.
 *
 * Two cases deliberately return everything rather than an empty screen: an
 * empty selection (which the pickers prevent, but which a corrupted stored
 * value could still produce) and a selection that matches no track at all. In
 * practice a picker only offers languages the event actually has, so the
 * latter is rare.
 */
export function filterTracksByLanguage(
  tracks: TrackWithSession[],
  selected: string[],
): TrackWithSession[] {
  if (tracks.length === 0) return [];
  if (selected.length === 0) return tracks;

  const wanted = new Set(selected);
  const filterable = new Set(getFilterableLanguages(tracks));
  const filtered = tracks.filter((t) => {
    const languages = trackLanguages(t);
    return (
      languages.some((code) => wanted.has(code)) ||
      !languages.some((code) => filterable.has(code))
    );
  });
  return filtered.length === 0 ? tracks : filtered;
}

/**
 * The languages the per-event picker offers.
 *
 * A selection can only swap one track for another when the two share no
 * language: a TIB+ENG file against its POR translation, an ENG track against a
 * POR one. A track that shares a language with every other track (one file
 * holding TIB ING POR, an ENG+POR introduction next to it) is never an
 * alternative to anything, so its languages alone would be boxes that hide
 * nothing when unticked. Only languages of tracks that have such a disjoint
 * counterpart are offered.
 */
export function getFilterableLanguages(tracks: Track[]): string[] {
  const sets = new Map<string, string[]>();
  for (const t of tracks) {
    const languages = trackLanguages(t);
    if (languages.length > 0) sets.set([...languages].sort().join(','), languages);
  }
  const distinct = [...sets.values()];
  const present = new Set<string>();
  distinct.forEach((a, i) => {
    distinct.slice(i + 1).forEach((b) => {
      if (a.some((code) => b.includes(code))) return;
      a.forEach((code) => present.add(code));
      b.forEach((code) => present.add(code));
    });
  });
  return sortLanguageCodes([...present]);
}

/**
 * Whether the per-event language picker would change anything: it needs two
 * tracks with no language in common. A monolingual event, or one whose tracks
 * all overlap (TIB ING POR files, an ENG POR introduction…), has nothing to
 * choose.
 */
export function languagePickerFiltersTracks(tracks: Track[]): boolean {
  return getFilterableLanguages(tracks).length >= 2;
}
