import { useCallback, useEffect, useRef } from 'react';

/** Quiet period after the last results before a search counts as final. */
export const SEARCH_LOG_IDLE_MS = 2000;

/** Same normalisation the API applies: trim, collapse whitespace, lowercase. */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

type LogFn = (query: string, resultCount: number) => void;

/**
 * Decides when a search is "final" and worth logging, so partial queries
 * typed on the way ("bud", "buddh") are never recorded.
 *
 * - `onResults` records the latest results and arms a 2 s idle timer.
 * - `onTyping` drops the pending search (the text it describes is stale).
 * - `flush` logs the pending search now (result opened, keyboard submitted).
 * A query is never logged twice in a row, and empty ones never are.
 */
export function useSearchLogger(log: LogFn) {
  const logRef = useRef(log);
  logRef.current = log;
  const pending = useRef<{ query: string; resultCount: number } | null>(null);
  const lastLogged = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const flush = useCallback(() => {
    clearTimer();
    const item = pending.current;
    pending.current = null;
    if (!item || item.query.length === 0) return;
    if (item.query === lastLogged.current) return;
    lastLogged.current = item.query;
    logRef.current(item.query, item.resultCount);
  }, []);

  const onResults = useCallback(
    (rawQuery: string, resultCount: number) => {
      clearTimer();
      const query = normalizeSearchQuery(rawQuery);
      if (query.length === 0) {
        pending.current = null;
        return;
      }
      pending.current = { query, resultCount };
      timer.current = setTimeout(flush, SEARCH_LOG_IDLE_MS);
    },
    [flush],
  );

  const onTyping = useCallback(() => {
    clearTimer();
    pending.current = null;
  }, []);

  useEffect(() => clearTimer, []);

  return { onResults, onTyping, flush };
}
