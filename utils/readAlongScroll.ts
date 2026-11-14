/** Where the word being read sits in the visible text, from the top. */
export const READING_LINE = 0.35;
// The word may drift between these fractions of the view before the text moves.
const BAND_TOP = 0.15;
const BAND_BOTTOM = 0.7;

interface ReadingScrollInput {
  /** The word's top and height, in scroll-content coordinates. */
  wordY: number;
  wordHeight: number;
  scrollY: number;
  /** Height of the part of the text not covered by the player. */
  viewportHeight: number;
  /** Recenter even when the word is still comfortably in view. */
  force?: boolean;
}

/**
 * The scroll offset that puts the word being read on the reading line, or
 * `null` when the text should stay where it is.
 */
export function readingScrollTarget({
  wordY,
  wordHeight,
  scrollY,
  viewportHeight,
  force = false,
}: ReadingScrollInput): number | null {
  if (viewportHeight <= 0) return null;
  const target = Math.max(0, wordY - viewportHeight * READING_LINE);
  if (force) return target;
  const inBand =
    wordY >= scrollY + viewportHeight * BAND_TOP &&
    wordY + wordHeight <= scrollY + viewportHeight * BAND_BOTTOM;
  return inBand ? null : target;
}
