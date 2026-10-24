/**
 * A "whole video" bookmark is a video bookmark at position 0 with no note:
 * the heart-style toggle on a video card, as opposed to the moment
 * bookmarks made inside the player.
 */

interface BookmarkLike {
  id: number;
  videoId: number;
  positionSeconds: number;
  note: string | null;
}

export function isWholeVideoBookmark(bookmark: Pick<BookmarkLike, 'positionSeconds' | 'note'>): boolean {
  return bookmark.positionSeconds === 0 && !bookmark.note?.trim();
}

/** Bookmark ids per video, for the whole-video bookmarks in a list. */
export function groupWholeVideoBookmarks(bookmarks: BookmarkLike[]): Map<number, number[]> {
  const byVideo = new Map<number, number[]>();
  for (const bm of bookmarks) {
    if (!isWholeVideoBookmark(bm)) continue;
    byVideo.set(bm.videoId, [...(byVideo.get(bm.videoId) ?? []), bm.id]);
  }
  return byVideo;
}
