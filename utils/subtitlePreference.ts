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
 * Takes a single language rather than a set: only one track can be enabled at
 * a time, and subtitles are app chrome, so callers pass the interface
 * language. Falls back to the other supported language, then to the first
 * track offered.
 * Language codes are matched loosely with `startsWith` so regional variants
 * like `en-US` still hit `en`. Returns `null` only when there are no tracks.
 */
export function pickPreferredSubtitle<T extends SubtitleLike>(
  tracks: T[],
  preferredLanguage: string,
): T | null {
  if (tracks.length === 0) return null;

  const order = [...new Set([preferredLanguage, 'en', 'pt'])];
  for (const code of order) {
    const match = tracks.find((track) => track.language?.toLowerCase().startsWith(code));
    if (match) return match;
  }
  return tracks[0];
}
