/**
 * Which languages a user sees for an event's audio tracks.
 *
 * The model has two levels:
 *
 * - A single global preference — **show Portuguese, yes or no**. There is no
 *   global language *set*, because the language a teaching was given in
 *   varies per event and the app should never hide it.
 * - A per-event selection (checkboxes on the event itself), which overrides
 *   the default for that event only.
 *
 * On a first visit the selection is derived, never stored: the event's
 * original language, plus English, plus Portuguese if the toggle is on. The
 * original is always included, so a Tibetan teaching is never reduced to its
 * English translation — which would make it look as though the translator,
 * not the teacher, gave it.
 */

/**
 * Tibetan is the source language for many teachings and sorts first, then the
 * translations. Unknown codes sort last via `?? 99`.
 */
export const LANG_ORDER: Record<string, number> = { tib: 0, en: 1, pt: 2, es: 3, fr: 4 };

/** A set of content-language codes, e.g. `['tib', 'en']`. */
export type ContentLanguages = string[];

/** Dedupe and order codes tib → en → pt → es → fr, unknown codes last. */
export function sortLanguageCodes(codes: string[]): string[] {
  return [...new Set(codes)].sort(
    (a, b) => (LANG_ORDER[a] ?? 99) - (LANG_ORDER[b] ?? 99),
  );
}

/**
 * The languages shown on a first visit to an event.
 *
 * The rule is: the event's original language, plus English (unless English
 * *is* the original), plus Portuguese when the user has asked for it. That
 * set is then narrowed to what the event actually offers.
 *
 * Two fallbacks keep the reader from being stranded:
 * - Nothing in the rule is present → show everything the event has.
 * - Only the original survives while the event offers more → show everything
 *   too. This is the Tibetan-event-with-Portuguese-but-no-English case: the
 *   rule alone would leave a reader with Tibetan audio and nothing else.
 */
export function defaultForEvent(
  originalLanguage: string,
  showPortuguese: boolean,
  eventLanguages: string[],
): string[] {
  const wanted = [originalLanguage, 'en'];
  if (showPortuguese) wanted.push('pt');
  const base = sortLanguageCodes(wanted);

  if (eventLanguages.length === 0) return base;

  const available = new Set(eventLanguages);
  const narrowed = base.filter((code) => available.has(code));

  // The languages the user actually reads: English, plus Portuguese when they
  // asked for it. If none of them survived the narrowing, the rule has left
  // them with audio they cannot follow — a Tibetan event carrying Portuguese
  // but no English, say — so show the whole event instead. Note the original
  // counts here when it happens to be one of them, which is why an English
  // event does not trip this.
  const readable = new Set(showPortuguese ? ['en', 'pt'] : ['en']);
  if (!narrowed.some((code) => readable.has(code))) {
    return sortLanguageCodes(eventLanguages);
  }
  return narrowed;
}

/**
 * Narrow an explicit per-event choice to what the event still offers. Unlike
 * `defaultForEvent` this never second-guesses the user — it only guards
 * against a stored language the event no longer has.
 */
export function narrowToEvent(selected: string[], eventLanguages: string[]): string[] {
  if (eventLanguages.length === 0) return sortLanguageCodes(selected);
  const available = new Set(eventLanguages);
  const narrowed = selected.filter((code) => available.has(code));
  return sortLanguageCodes(narrowed.length > 0 ? narrowed : eventLanguages);
}

/** Serialize a per-event selection for AsyncStorage. */
export function serializeContentLanguages(codes: string[]): string {
  return JSON.stringify(sortLanguageCodes(codes));
}

/**
 * Read a per-event preference. Returns `null` when nothing is stored, meaning
 * the derived default applies.
 *
 * The per-event picker always offered every language the event has, so a
 * legacy single code was a deliberate choice and migrates literally. The old
 * `'all'`/`'en-pt'` sentinels become the empty set, which `narrowToEvent`
 * expands to the whole event.
 */
export function parseEventLanguages(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  if (raw === 'all' || raw === 'en-pt') return [];
  if (/^[a-z]{2,3}$/.test(raw)) return [raw];
  if (!raw.startsWith('[')) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const codes = parsed.filter(
      (code): code is string => typeof code === 'string' && code.length > 0,
    );
    return codes.length > 0 ? sortLanguageCodes(codes) : null;
  } catch {
    return null;
  }
}

/** The global toggle's value when the user has never set it. */
export function defaultShowPortuguese(appLanguage: string): boolean {
  return appLanguage === 'pt';
}

/** Read the stored toggle. `null` means the user has never set it. */
export function parseShowPortuguese(raw: string | null | undefined): boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

/**
 * Derive the toggle from a legacy `content_language` value, so an existing
 * preference is not silently reset. Covers the shipped single values
 * (`'en'`, `'pt'`, `'en-pt'`) and the sentinel `'all'`.
 */
export function showPortugueseFromLegacy(raw: string | null | undefined): boolean | null {
  if (!raw) return null;
  if (raw === 'all' || raw === 'en-pt' || raw === 'pt') return true;
  if (raw === 'en') return false;
  if (raw.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.includes('pt');
    } catch {
      return null;
    }
  }
  return null;
}
