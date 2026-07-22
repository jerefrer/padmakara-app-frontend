/**
 * Anything with a language code — matches both expo-video's `SubtitleTrack`
 * and hls.js's subtitle-track entries (mapped to `{ language }`).
 */
export interface SubtitleLike {
  language: string;
}

/**
 * Choose which subtitle track to enable by default.
 *
 * Prefers the user's content language, then their UI language (the tiebreak
 * for bilingual "en-pt" readers), then the first track offered. Language codes
 * are matched loosely with `startsWith` so regional variants like `en-US`
 * still hit `en`. Returns `null` only when there are no tracks at all.
 */
export function pickPreferredSubtitle<T extends SubtitleLike>(
  tracks: T[],
  contentLanguage: string,
  uiLanguage: string,
): T | null {
  if (tracks.length === 0) return null;
  const order =
    contentLanguage === 'pt'
      ? ['pt', 'en']
      : contentLanguage === 'en'
        ? ['en', 'pt']
        : uiLanguage === 'pt'
          ? ['pt', 'en']
          : ['en', 'pt']; // "en-pt" bilingual → follow the UI language
  for (const code of order) {
    const match = tracks.find((track) => track.language?.toLowerCase().startsWith(code));
    if (match) return match;
  }
  return tracks[0];
}
