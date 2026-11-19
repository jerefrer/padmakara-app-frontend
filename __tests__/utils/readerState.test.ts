import {
  chapterOfPage,
  latestPosition,
  mergeBookmarks,
  resumePage,
  resumeTarget,
  withBookmark,
} from '@/utils/readerState';
import { buildSpreads, spreadIndexOfPage } from '@/utils/pdfViewerLayout';

describe('latestPosition', () => {
  it('should keep the page read most recently, wherever it was read', () => {
    const device = { page: 12, at: 2000 };
    const server = { page: 40, at: 1000 };

    expect(latestPosition(device, server)).toBe(device);
    expect(latestPosition(server, device)).toBe(device);
  });

  it('should take whichever exists when the other is missing', () => {
    expect(latestPosition(null, { page: 3, at: 1 })).toEqual({ page: 3, at: 1 });
    expect(latestPosition({ page: 3, at: 1 }, undefined)).toEqual({ page: 3, at: 1 });
    expect(latestPosition(null, null)).toBeNull();
  });
});

describe('resumePage', () => {
  it('should resume on the saved page', () => {
    expect(resumePage({ page: 12, at: 1 })).toBe(12);
  });

  it('should open on the first page when nothing was saved or the saved page is the first', () => {
    expect(resumePage(null)).toBeNull();
    expect(resumePage({ page: 1, at: 1 })).toBeNull();
  });

  it('should stay inside a document that got shorter', () => {
    expect(resumePage({ page: 120, at: 1 }, 80)).toBe(80);
  });

  it('should ignore an unknown page count', () => {
    expect(resumePage({ page: 120, at: 1 }, null)).toBe(120);
  });
});

describe('resumeTarget', () => {
  it('should open a loaded document on the page asked for, inside its pages', () => {
    expect(resumeTarget(12, 40)).toBe(12);
    expect(resumeTarget(50, 40)).toBe(40);
    expect(resumeTarget(null, 40)).toBe(1);
    expect(resumeTarget(0, 40)).toBe(1);
  });

  it('should show the spread holding the resumed page in two-page mode', () => {
    const spreads = buildSpreads('two', 40);

    expect(spreads[spreadIndexOfPage(spreads, resumeTarget(12, 40))]).toEqual([12, 13]);
    expect(spreads[spreadIndexOfPage(spreads, resumeTarget(13, 40))]).toEqual([12, 13]);
    // The cover stands alone.
    expect(spreads[spreadIndexOfPage(spreads, resumeTarget(1, 40))]).toEqual([1]);
  });

  it('should show the last spread when the resumed page is the last of an even document', () => {
    const spreads = buildSpreads('two', 40);

    expect(spreads[spreadIndexOfPage(spreads, resumeTarget(99, 40))]).toEqual([40]);
  });
});

describe('mergeBookmarks', () => {
  it('should lay the changes not yet sent over the server pages, in page order', () => {
    expect(mergeBookmarks([12, 3], { '20': 'add', '3': 'remove' })).toEqual([12, 20]);
  });

  it('should ignore a pending change on an invalid page', () => {
    expect(mergeBookmarks([4], { abc: 'add', '0': 'add' })).toEqual([4]);
  });
});

describe('withBookmark', () => {
  it('should add a page once and keep the pages in order', () => {
    expect(withBookmark([12], 3, true)).toEqual([3, 12]);
    expect(withBookmark([3, 12], 3, true)).toEqual([3, 12]);
  });

  it('should remove a page', () => {
    expect(withBookmark([3, 12], 3, false)).toEqual([12]);
  });
});

describe('chapterOfPage', () => {
  const outline = [
    { title: 'Day one', page: 3, depth: 0 },
    { title: 'Morning', page: 4, depth: 1 },
    { title: 'Day two', page: 15, depth: 0 },
    { title: 'Questions', page: 15, depth: 1 },
  ];

  it('should name the entry the page falls under', () => {
    expect(chapterOfPage(outline, 9)).toBe('Morning');
    expect(chapterOfPage(outline, 3)).toBe('Day one');
  });

  it('should name the deepest entry when several start on the page', () => {
    expect(chapterOfPage(outline, 20)).toBe('Questions');
  });

  it('should name nothing before the first entry or without an outline', () => {
    expect(chapterOfPage(outline, 2)).toBeNull();
    expect(chapterOfPage([], 9)).toBeNull();
  });
});
