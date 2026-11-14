import { paragraphProgress, wordOffsets } from '@/utils/readAlongParagraphs';

const w = (segIdx: number, wordIdx: number, word: string) => ({
  word: { word, start: 0, end: 0, confidence: 'high' as const },
  segIdx,
  wordIdx,
});

const para = [w(4, 0, ' Hello'), w(4, 1, ' world'), w(5, 0, ' again')];

describe('paragraphProgress', () => {
  it('should find the word being read inside the paragraph', () => {
    expect(paragraphProgress(para, 4, 1)).toEqual({ activeIdx: 1, isPast: false });
  });

  it('should mark a paragraph that ended before the current segment as past', () => {
    expect(paragraphProgress(para, 9, 0)).toEqual({ activeIdx: -1, isPast: true });
  });

  it('should leave a paragraph still to come untouched', () => {
    expect(paragraphProgress(para, 2, 0)).toEqual({ activeIdx: -1, isPast: false });
  });

  it('should mark the paragraph past when the reading is later in its last segment', () => {
    expect(paragraphProgress(para, 5, 3)).toEqual({ activeIdx: -1, isPast: true });
  });

  it('should report nothing between segments', () => {
    expect(paragraphProgress(para, -1, -1)).toEqual({ activeIdx: -1, isPast: false });
  });
});

describe('wordOffsets', () => {
  it('should place each trimmed word after a single space', () => {
    expect(wordOffsets(para)).toEqual([0, 6, 12]);
  });
});
