import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { readerStateService, SIGNED_OUT_ACCOUNT } from '@/services/readerStateService';
import { resumePage, withBookmark, type ReaderDocument } from '@/utils/readerState';

/** Longest wait for the server before opening on the device's own last page. */
export const RESUME_SERVER_WAIT_MS = 1500;
/** Quiet time after a page turn before the page is saved. */
export const SAVE_PAGE_DELAY_MS = 2000;

export interface ReaderDocumentState {
  /** False until the page to open on is known: the viewer waits for it. */
  ready: boolean;
  /** The page to open on, decided once per document; null = the first page. */
  initialPage: number | null;
  /** Bookmarked pages, in page order. */
  bookmarks: number[];
  /** Report the page on screen; saved once the reader stays on it a moment. */
  reportPage: (page: number) => void;
  /** Bookmark the page or remove its bookmark. */
  setBookmark: (page: number, on: boolean) => void;
}

/**
 * The reader's memory of one PDF: where to reopen it and its page bookmarks
 * (see utils/readerState and services/readerStateService).
 *
 * On open, the device's state is read at once and, signed in, the server's is
 * awaited for up to RESUME_SERVER_WAIT_MS: the initial page is decided then
 * and never changes while the document stays open (a late answer only brings
 * the bookmarks). The page is saved SAVE_PAGE_DELAY_MS after the last turn,
 * and at once when the document closes or the app goes to the background.
 */
export function useReaderDocument(
  doc: ReaderDocument | null,
  { pageCount }: { pageCount?: number | null } = {},
): ReaderDocumentState {
  const { isAuthenticated, user } = useAuth();
  const signedIn = isAuthenticated && !!user;
  const account = signedIn && user ? String(user.id) : SIGNED_OUT_ACCOUNT;
  const docKey = doc ? `${doc.type}:${doc.id}` : null;

  const [state, setState] = useState<{ key: string | null; ready: boolean; initialPage: number | null; bookmarks: number[] }>(
    { key: null, ready: false, initialPage: null, bookmarks: [] },
  );

  // Read in effects and handlers without making them re-run. Updated first:
  // effects run in order, so the ones below see this render's values.
  const docRef = useRef(doc);
  const pageCountRef = useRef(pageCount);
  useEffect(() => {
    docRef.current = doc;
    pageCountRef.current = pageCount;
  });

  // ── Open: decide the page, load the bookmarks ─────────────────────────
  useEffect(() => {
    const current = docRef.current;
    if (!docKey || !current) {
      setState({ key: null, ready: false, initialPage: null, bookmarks: [] });
      return;
    }
    let cancelled = false;
    let decided = false;
    setState({ key: docKey, ready: false, initialPage: null, bookmarks: [] });

    const decide = (position: Parameters<typeof resumePage>[0], bookmarks: number[]) => {
      if (cancelled) return;
      if (decided) {
        setState((s) => (s.key === docKey ? { ...s, bookmarks } : s));
        return;
      }
      decided = true;
      setState({ key: docKey, ready: true, initialPage: resumePage(position, pageCountRef.current), bookmarks });
    };

    (async () => {
      const local = await readerStateService.getLocalState(current, account);
      if (!signedIn) {
        decide(local.position, local.bookmarks);
        return;
      }
      const timer = setTimeout(() => decide(local.position, local.bookmarks), RESUME_SERVER_WAIT_MS);
      const synced = await readerStateService.syncWithServer(current, account).catch(() => null);
      clearTimeout(timer);
      if (synced) decide(synced.position, synced.bookmarks);
      else decide(local.position, local.bookmarks);
    })();

    return () => {
      cancelled = true;
    };
  }, [docKey, account, signedIn]);

  // ── Saving the page ───────────────────────────────────────────────────
  const pendingSave = useRef<{ doc: ReaderDocument; page: number; signedIn: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const save = pendingSave.current;
    pendingSave.current = null;
    if (save) void readerStateService.savePosition(save.doc, save.page, { signedIn: save.signedIn });
  }, []);

  const reportPage = useCallback(
    (page: number) => {
      const current = docRef.current;
      if (!current || !Number.isSafeInteger(page) || page < 1) return;
      pendingSave.current = { doc: current, page, signedIn };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_PAGE_DELAY_MS);
    },
    [flush, signedIn],
  );

  // Closing the document (or switching to another) saves its page now.
  useEffect(() => flush, [docKey, flush]);

  // Leaving the app: the page is saved before the system may end it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') flush();
    });
    if (Platform.OS !== 'web' || typeof document === 'undefined') return () => sub.remove();
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      sub.remove();
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  // ── Bookmarks ─────────────────────────────────────────────────────────
  const setBookmark = useCallback(
    (page: number, on: boolean) => {
      const current = docRef.current;
      if (!current || !docKey) return;
      setState((s) => (s.key === docKey ? { ...s, bookmarks: withBookmark(s.bookmarks, page, on) } : s));
      void readerStateService.setBookmark(current, account, page, on).then((pages) => {
        setState((s) => (s.key === docKey ? { ...s, bookmarks: pages } : s));
      });
    },
    [account, docKey],
  );

  const own = state.key === docKey;
  return {
    ready: own && state.ready,
    initialPage: own ? state.initialPage : null,
    bookmarks: own ? state.bookmarks : [],
    reportPage,
    setBookmark,
  };
}
