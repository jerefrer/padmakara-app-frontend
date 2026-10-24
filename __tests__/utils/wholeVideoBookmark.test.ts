import { groupWholeVideoBookmarks, isWholeVideoBookmark } from '@/utils/wholeVideoBookmark';

describe('isWholeVideoBookmark', () => {
  it('should accept position zero without a note', () => {
    expect(isWholeVideoBookmark({ positionSeconds: 0, note: null })).toBe(true);
    expect(isWholeVideoBookmark({ positionSeconds: 0, note: '  ' })).toBe(true);
  });

  it('should reject a moment bookmark or one with a note', () => {
    expect(isWholeVideoBookmark({ positionSeconds: 30, note: null })).toBe(false);
    expect(isWholeVideoBookmark({ positionSeconds: 0, note: 'x' })).toBe(false);
  });
});

describe('groupWholeVideoBookmarks', () => {
  it('should collect ids per video and skip moment bookmarks', () => {
    const map = groupWholeVideoBookmarks([
      { id: 1, videoId: 5, positionSeconds: 0, note: null },
      { id: 2, videoId: 5, positionSeconds: 0, note: null },
      { id: 3, videoId: 6, positionSeconds: 12, note: null },
    ]);
    expect(map.get(5)).toEqual([1, 2]);
    expect(map.has(6)).toBe(false);
  });
});
