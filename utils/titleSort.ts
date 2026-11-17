/**
 * Alphabetical order for titles, the way a library files them: a leading
 * article does not count ("O Tesouro de Bênçãos" goes under T), and neither
 * do opening quotes or punctuation. Only the order changes; titles are still
 * displayed as written.
 */

// Portuguese o/a/os/as/um/uma/uns/umas and English the/a/an ("a" is both).
const LEADING_ARTICLE = /^(?:o|a|os|as|um|uma|uns|umas|the|an)\s+(?=\S)/i;
const LEADING_PUNCTUATION = /^[^\p{L}\p{N}]+/u;

// Accents and case are ignored ("Ética" files with "etica"), numbers compare
// by value ("Volume 2" before "Volume 10").
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** The part of a title that decides its place in an alphabetical list. */
export function titleSortKey(title: string): string {
  const text = title.trim().replace(LEADING_PUNCTUATION, '');
  return text.replace(LEADING_ARTICLE, '');
}

/** Sort comparator for titles; see titleSortKey. */
export function compareTitles(a: string, b: string): number {
  return collator.compare(titleSortKey(a), titleSortKey(b)) || collator.compare(a, b);
}
