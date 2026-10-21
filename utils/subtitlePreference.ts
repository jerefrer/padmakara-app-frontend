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

/** Subtitle languages a viewer can choose in Settings, in the order they are offered. */
const SUBTITLE_LANGUAGES = ['en', 'pt', 'fr', 'es'] as const;

/** The stored value meaning "never turn subtitles on by default". */
export const SUBTITLES_OFF = 'off';

/**
 * Read a stored subtitle choice. `null` means the viewer never chose (or the
 * stored value is unusable), so the interface language applies.
 */
export function parseSubtitleChoice(raw: string | null | undefined): string | null {
  if (raw === SUBTITLES_OFF) return raw;
  return (SUBTITLE_LANGUAGES as readonly string[]).includes(raw ?? '') ? (raw as string) : null;
}

/**
 * The language to turn on when a video starts, or `null` for no subtitles.
 * Without a stored choice this is the interface language, as it was before
 * the setting existed.
 */
export function resolveSubtitleLanguage(
  stored: string | null,
  interfaceLanguage: string,
): string | null {
  if (stored === SUBTITLES_OFF) return null;
  return parseSubtitleChoice(stored) ?? interfaceLanguage;
}

/** The choices Settings lists: the interface language first, then the rest, then "off". */
export function subtitleChoiceOrder(interfaceLanguage: string): string[] {
  return [
    ...new Set([interfaceLanguage, ...SUBTITLE_LANGUAGES]),
    SUBTITLES_OFF,
  ].filter((code) => code === SUBTITLES_OFF || (SUBTITLE_LANGUAGES as readonly string[]).includes(code));
}
