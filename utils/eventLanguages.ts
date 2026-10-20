import { getLanguageShortLabel } from '@/components/LanguageCheckboxList';
import type { Gathering } from '@/types';

/** `bo` is the ISO code for Tibetan; the app's own code is `tib`. */
const LANGUAGE_CODE_ALIASES: Record<string, string> = { bo: 'tib' };

/**
 * Collect distinct languages across the event's tracks, in display order,
 * abbreviated in the interface's language ("Ing" in Portuguese, "En" in English).
 */
export function eventLanguages(event: Gathering, t: (key: string) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of event.sessions || []) {
    for (const track of s.tracks || []) {
      const langs = track.languages?.length ? track.languages : track.originalLanguage ? [track.originalLanguage] : [];
      for (const raw of langs) {
        const lower = raw?.toLowerCase();
        const key = lower ? LANGUAGE_CODE_ALIASES[lower] ?? lower : lower;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const short = getLanguageShortLabel(key, t);
        out.push(short.charAt(0) + short.slice(1).toLowerCase());
      }
    }
  }
  return out;
}
