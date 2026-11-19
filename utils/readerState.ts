/**
 * The reader's memory of a PDF (a publication or a transcript): the page the
 * person was last on, so it reopens there, and the pages they bookmarked.
 *
 * Two sources hold it, as for the "Last opened" order (utils/publicationOrder):
 * the server, for the signed-in person on any device, and this device, which
 * also works signed out and offline.
 *
 * - The last page: the most recent of the two wins (each carries the time the
 *   reader was on it).
 * - Bookmarks: signed in, the server's set is the truth, with this device's
 *   changes not yet sent laid over it; signed out, the device's set alone.
 */

import type { PdfOutlineItem } from './pdfOutline';

export type ReaderDocumentType = 'publication' | 'transcript';

export interface ReaderDocument {
  type: ReaderDocumentType;
  id: string;
}

/** A page and when the reader was on it (epoch ms). */
export interface ReaderPosition {
  page: number;
  at: number;
}

/** A bookmark change made on this device and not yet confirmed by the server. */
export type PendingBookmarkChange = 'add' | 'remove';

/** Page → change waiting to be sent. */
export type PendingBookmarks = Record<string, PendingBookmarkChange>;

/** The later of two positions; either may be missing. */
export function latestPosition(
  a: ReaderPosition | null | undefined,
  b: ReaderPosition | null | undefined,
): ReaderPosition | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.at > a.at ? b : a;
}

/**
 * The page to open the document on: the saved one, kept inside the document
 * when its page count is known (a replaced file may be shorter). Null when
 * there is nothing to resume, i.e. open on the first page.
 */
export function resumePage(position: ReaderPosition | null, pageCount?: number | null): number | null {
  if (!position || !Number.isFinite(position.page)) return null;
  let page = Math.max(1, Math.floor(position.page));
  if (pageCount && pageCount > 0) page = Math.min(page, pageCount);
  return page > 1 ? page : null;
}

/** The page a loaded document opens on: the one asked for, inside its `pageCount` pages; else the first. */
export function resumeTarget(initialPage: number | null | undefined, pageCount: number): number {
  if (!initialPage || !Number.isFinite(initialPage) || pageCount < 1) return 1;
  return Math.min(pageCount, Math.max(1, Math.floor(initialPage)));
}

/** The server's bookmarked pages with the changes still waiting to be sent, in page order. */
export function mergeBookmarks(serverPages: number[], pending: PendingBookmarks): number[] {
  const pages = new Set(serverPages);
  for (const [key, change] of Object.entries(pending)) {
    const page = Number(key);
    if (!Number.isSafeInteger(page) || page < 1) continue;
    if (change === 'add') pages.add(page);
    else pages.delete(page);
  }
  return [...pages].sort((x, y) => x - y);
}

/** `pages` with `page` added or removed, in page order. */
export function withBookmark(pages: number[], page: number, on: boolean): number[] {
  const set = new Set(pages);
  if (on) set.add(page);
  else set.delete(page);
  return [...set].sort((x, y) => x - y);
}

/**
 * The table of contents entry a page falls under: the last entry starting at
 * or before it (the deepest one when several start on the same page). Null
 * before the first entry or without an outline.
 */
export function chapterOfPage(outline: PdfOutlineItem[], page: number): string | null {
  let found: PdfOutlineItem | null = null;
  for (const item of outline) {
    if (item.page > page) continue;
    if (!found || item.page > found.page || (item.page === found.page && item.depth >= found.depth)) found = item;
  }
  return found?.title ?? null;
}
