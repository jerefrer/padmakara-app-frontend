import type { Track } from '@/types';

const LANG_ORDER: Record<string, number> = { en: 0, pt: 1, es: 2, fr: 3 };

/**
 * Per-session sort: by `order` ascending, then `isOriginal` first,
 * then by language order (en < pt < es < fr; unknown sorts last).
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
    const aLang = LANG_ORDER[a.originalLanguage || a.language || 'en'] ?? 4;
    const bLang = LANG_ORDER[b.originalLanguage || b.language || 'en'] ?? 4;
    return aLang - bLang;
  });
}

export type ContentLanguageMode = 'en' | 'pt' | 'en-pt';

export interface TrackWithSession extends Track {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionType: string;
  sessionPartNumber?: number | null;
}

/**
 * Apply the user's content-language preference to a flat track list.
 *
 * Extracted from `app/(tabs)/(groups)/retreat/[id].tsx`. The original inline
 * implementation only checked `isOriginal` and `language` (deprecated singular
 * field) when deciding whether tracks had language metadata, which meant
 * tracks populated with only the modern `languages` array would bypass
 * filtering entirely. The check below also recognizes a non-empty `languages`
 * array — this fixes a latent production bug where bilingual events whose
 * tracks were tagged with `languages: ['en','pt']` (without legacy fields)
 * showed all tracks regardless of the user's selected content language.
 */
export function filterTracksByLanguage(
  tracks: TrackWithSession[],
  mode: ContentLanguageMode,
): TrackWithSession[] {
  if (tracks.length === 0) return [];

  const hasLanguageMetadata = tracks.some(
    (t) =>
      t.isOriginal !== undefined ||
      t.language ||
      (t.languages && t.languages.length > 0),
  );
  if (!hasLanguageMetadata) return tracks;

  if (mode === 'en') {
    return tracks.filter(
      (t) => t.languages?.includes('en') ?? t.isOriginal !== false,
    );
  }
  if (mode === 'en-pt') {
    return tracks;
  }
  if (mode === 'pt') {
    const filtered = tracks.filter(
      (t) =>
        t.languages?.includes('pt') ??
        (!t.isOriginal && t.language === 'pt'),
    );
    return filtered.length === 0 ? tracks : filtered;
  }
  return tracks;
}
