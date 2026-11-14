import type { ReadAlongWord } from '@/types';

export type ParaWords = { word: ReadAlongWord; segIdx: number; wordIdx: number }[];

/**
 * Where the reading stands in one paragraph: the index of the word being read
 * (-1 when it is elsewhere) and whether the whole paragraph is already past.
 */
export function paragraphProgress(
  words: ParaWords,
  activeSegmentIndex: number,
  activeWordIndex: number,
): { activeIdx: number; isPast: boolean } {
  if (activeSegmentIndex < 0 || words.length === 0) return { activeIdx: -1, isPast: false };
  const first = words[0];
  const last = words[words.length - 1];
  // Cheap range checks first: most paragraphs are wholly before or after.
  if (last.segIdx < activeSegmentIndex) return { activeIdx: -1, isPast: true };
  if (first.segIdx > activeSegmentIndex) return { activeIdx: -1, isPast: false };
  const activeIdx = words.findIndex(
    (pw) => pw.segIdx === activeSegmentIndex && pw.wordIdx === activeWordIndex,
  );
  const isPast =
    activeIdx === -1 &&
    last.segIdx === activeSegmentIndex &&
    activeWordIndex >= 0 &&
    last.wordIdx < activeWordIndex;
  return { activeIdx, isPast };
}

/** Where each word starts in the paragraph's text: words joined by one space. */
export function wordOffsets(words: ParaWords): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (let i = 0; i < words.length; i++) {
    if (i > 0) offset += 1;
    starts.push(offset);
    offset += words[i].word.word.trim().length;
  }
  return starts;
}
