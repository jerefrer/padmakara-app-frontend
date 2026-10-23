import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import eventBookmarkService from '@/services/eventBookmarkService';

/**
 * The signed-in user's bookmarked event ids, for list rows that show a
 * bookmark toggle. Refreshes whenever the screen gains focus (so a bookmark
 * made on the event page shows up when going back). Signed-out users get
 * `enabled: false` and no API call, like the event page header.
 */
export function useEventBookmarks() {
  const { isAuthenticated } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const busy = useRef<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setIds(new Set());
        return;
      }
      let cancelled = false;
      (async () => {
        const res = await eventBookmarkService.list();
        if (cancelled || !res.success || !res.data) return;
        setIds(new Set(res.data.map((bm) => String(bm.eventId))));
      })();
      return () => {
        cancelled = true;
      };
    }, [isAuthenticated]),
  );

  const isBookmarked = useCallback((eventId: string | number) => ids.has(String(eventId)), [ids]);

  const toggle = useCallback(
    async (eventId: string | number) => {
      const key = String(eventId);
      if (busy.current.has(key)) return;
      busy.current.add(key);
      const was = ids.has(key);
      const apply = (on: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (on) next.add(key);
          else next.delete(key);
          return next;
        });
      apply(!was); // optimistic
      try {
        const res = was
          ? await eventBookmarkService.remove(eventId)
          : await eventBookmarkService.add(eventId);
        if (!res.success) apply(was); // revert
      } catch {
        apply(was);
      } finally {
        busy.current.delete(key);
      }
    },
    [ids],
  );

  return { enabled: isAuthenticated, isBookmarked, toggle };
}
