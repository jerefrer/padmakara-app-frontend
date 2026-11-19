/**
 * Reader state of a PDF (publication or transcript): the last page and the
 * page bookmarks, on this device and, signed in, on the server
 * (/api/reader/:type/:id). How the two are merged: utils/readerState.
 *
 * - The last page is kept per device (not per account), like the "Last
 *   opened" times: it is not personal, and a page read signed out still counts
 *   once the person signs in.
 * - Bookmarks are kept per account ('anon' when signed out), so one person's
 *   bookmarks never show up in another account's reader on a shared device.
 *   Signed in, the device copy mirrors the server and queues the changes made
 *   offline; they are sent on the next sync.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';
import {
  latestPosition,
  mergeBookmarks,
  withBookmark,
  type PendingBookmarks,
  type ReaderDocument,
  type ReaderPosition,
} from '../utils/readerState';

const POSITION_PREFIX = '@reader:position:';
const BOOKMARKS_PREFIX = '@reader:bookmarks:';
/** The former publication-only position, read once so a page saved before this feature is not lost. */
const LEGACY_PUBLICATION_POSITION_PREFIX = '@publication_position:';

/** Whose bookmarks: a user id, or 'anon' signed out. */
export type ReaderAccount = string;
export const SIGNED_OUT_ACCOUNT: ReaderAccount = 'anon';

interface StoredBookmarks {
  pages: number[];
  pending: PendingBookmarks;
}

export interface ReaderState {
  position: ReaderPosition | null;
  bookmarks: number[];
}

interface ServerReaderState {
  position: { page: number; updatedAt: string } | null;
  bookmarks: { page: number; createdAt: string }[];
}

/** A page bookmark as the Bookmarks tab lists it. */
export interface PageBookmark {
  documentType: ReaderDocument['type'];
  documentId: number;
  page: number;
  createdAt: string;
  document:
    | { type: 'publication'; id: number; title: string }
    | {
        type: 'transcript';
        id: number;
        language: string;
        event: { id: number; titleEn: string | null; titlePt: string | null } | null;
      };
}

const docKey = (doc: ReaderDocument) => `${doc.type}:${doc.id}`;

/** Server answers a client error (refused, gone): the change will never go through. */
const isFinalRefusal = (status?: number) => typeof status === 'number' && status >= 400 && status < 500;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Not kept on this device; the reader still works.
    console.error('Reader state save error:', err);
  }
}

function isPosition(value: unknown): value is ReaderPosition {
  return (
    !!value &&
    typeof value === 'object' &&
    Number.isFinite((value as ReaderPosition).page) &&
    Number.isFinite((value as ReaderPosition).at)
  );
}

function toPosition(server: ServerReaderState['position']): ReaderPosition | null {
  if (!server) return null;
  const at = Date.parse(server.updatedAt);
  return Number.isFinite(at) && Number.isFinite(server.page) ? { page: server.page, at } : null;
}

class ReaderStateService {
  /** This device's last page in the document. */
  async getLocalPosition(doc: ReaderDocument): Promise<ReaderPosition | null> {
    const stored = await readJson<unknown>(`${POSITION_PREFIX}${docKey(doc)}`);
    if (isPosition(stored)) return stored;
    if (doc.type === 'publication') {
      // Saved before positions had a time: older than anything saved since.
      const legacy = await readJson<unknown>(`${LEGACY_PUBLICATION_POSITION_PREFIX}${doc.id}`);
      if (typeof legacy === 'number' && Number.isFinite(legacy)) return { page: legacy, at: 0 };
    }
    return null;
  }

  private async getLocalBookmarks(doc: ReaderDocument, account: ReaderAccount): Promise<StoredBookmarks> {
    const stored = await readJson<StoredBookmarks>(`${BOOKMARKS_PREFIX}${account}:${docKey(doc)}`);
    return {
      pages: Array.isArray(stored?.pages) ? stored.pages.filter((p) => Number.isSafeInteger(p) && p >= 1) : [],
      pending: stored?.pending && typeof stored.pending === 'object' ? stored.pending : {},
    };
  }

  private async setLocalBookmarks(doc: ReaderDocument, account: ReaderAccount, value: StoredBookmarks) {
    await writeJson(`${BOOKMARKS_PREFIX}${account}:${docKey(doc)}`, value);
  }

  /** What this device knows, without the network: shown at once, before the server answers. */
  async getLocalState(doc: ReaderDocument, account: ReaderAccount): Promise<ReaderState> {
    const [position, bookmarks] = await Promise.all([
      this.getLocalPosition(doc),
      this.getLocalBookmarks(doc, account),
    ]);
    return { position, bookmarks: mergeBookmarks(bookmarks.pages, bookmarks.pending) };
  }

  /**
   * Signed in: send the bookmark changes made offline, read the server's
   * state, keep a copy on the device, and send this device's last page when it
   * is the more recent. Returns the merged state, or null when the server could
   * not be reached (the device state stands).
   */
  async syncWithServer(doc: ReaderDocument, account: ReaderAccount): Promise<ReaderState | null> {
    const stored = await this.getLocalBookmarks(doc, account);
    const pending = { ...stored.pending };
    for (const [page, change] of Object.entries(stored.pending)) {
      const res =
        change === 'add'
          ? await apiService.put(API_ENDPOINTS.READER_BOOKMARK(doc.type, doc.id, Number(page)))
          : await apiService.delete(API_ENDPOINTS.READER_BOOKMARK(doc.type, doc.id, Number(page)));
      if (res.success || isFinalRefusal(res.status)) delete pending[page];
    }

    const res = await apiService.get<ServerReaderState>(API_ENDPOINTS.READER_DOCUMENT(doc.type, doc.id));
    if (!res.success || !res.data) {
      await this.setLocalBookmarks(doc, account, { pages: stored.pages, pending });
      return null;
    }

    const serverPages = res.data.bookmarks.map((b) => b.page);
    await this.setLocalBookmarks(doc, account, { pages: serverPages, pending });

    const local = await this.getLocalPosition(doc);
    const server = toPosition(res.data.position);
    const position = latestPosition(local, server);
    if (position && position === local && local.at > 0) {
      void this.sendPosition(doc, local);
    } else if (position && position === server) {
      await writeJson(`${POSITION_PREFIX}${docKey(doc)}`, server);
    }
    return { position, bookmarks: mergeBookmarks(serverPages, pending) };
  }

  /** Remember the page the reader is on: on this device, and on the server when signed in. */
  async savePosition(doc: ReaderDocument, page: number, { signedIn }: { signedIn: boolean }): Promise<void> {
    const position: ReaderPosition = { page, at: Date.now() };
    await writeJson(`${POSITION_PREFIX}${docKey(doc)}`, position);
    if (signedIn) await this.sendPosition(doc, position);
  }

  private async sendPosition(doc: ReaderDocument, position: ReaderPosition): Promise<void> {
    // A lost call is caught up by the next sync, which sends the newer device page.
    await apiService.put(API_ENDPOINTS.READER_POSITION(doc.type, doc.id), {
      page: position.page,
      updatedAt: new Date(position.at).toISOString(),
    });
  }

  /**
   * Bookmark a page or remove its bookmark. Kept on the device at once; signed
   * in, sent to the server, or queued for the next sync when it cannot be
   * reached. Returns the document's bookmarked pages afterwards.
   */
  async setBookmark(
    doc: ReaderDocument,
    account: ReaderAccount,
    page: number,
    on: boolean,
  ): Promise<number[]> {
    const stored = await this.getLocalBookmarks(doc, account);
    if (account === SIGNED_OUT_ACCOUNT) {
      const pages = withBookmark(stored.pages, page, on);
      await this.setLocalBookmarks(doc, account, { pages, pending: {} });
      return pages;
    }

    const pending: PendingBookmarks = { ...stored.pending, [String(page)]: on ? 'add' : 'remove' };
    await this.setLocalBookmarks(doc, account, { pages: stored.pages, pending });

    const res = on
      ? await apiService.put(API_ENDPOINTS.READER_BOOKMARK(doc.type, doc.id, page))
      : await apiService.delete(API_ENDPOINTS.READER_BOOKMARK(doc.type, doc.id, page));
    if (res.success || isFinalRefusal(res.status)) {
      // Re-read: another change may have been queued while this call was out.
      const latest = await this.getLocalBookmarks(doc, account);
      const pages = res.success ? withBookmark(latest.pages, page, on) : latest.pages;
      const rest = { ...latest.pending };
      if (rest[String(page)] === pending[String(page)]) delete rest[String(page)];
      await this.setLocalBookmarks(doc, account, { pages, pending: rest });
      return mergeBookmarks(pages, rest);
    }
    return mergeBookmarks(stored.pages, pending);
  }

  /** Every page bookmark of the signed-in person, for the Bookmarks tab. */
  async listAllBookmarks(): Promise<{ success: boolean; data?: PageBookmark[]; error?: string; authRequired?: boolean }> {
    const res = await apiService.get<{ bookmarks: PageBookmark[] }>(API_ENDPOINTS.READER_BOOKMARKS);
    if (!res.success || !res.data) return { success: false, error: res.error, authRequired: res.authRequired };
    return { success: true, data: res.data.bookmarks };
  }
}

export const readerStateService = new ReaderStateService();
