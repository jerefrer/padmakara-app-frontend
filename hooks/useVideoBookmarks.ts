import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import videoBookmarkService from '@/services/videoBookmarkService';
import { groupWholeVideoBookmarks } from '@/utils/wholeVideoBookmark';

/** Stands in for the server id while a new bookmark is being created. */
const PENDING_ID = -1;

/**
 * Whole-video bookmarks (position 0, no note) of the signed-in user, for the
 * bookmark toggle on video cards. Same shape as `useEventBookmarks`: the list
 * refreshes whenever the screen gains focus, the toggle is optimistic and
 * reverts on failure, and signed-out users get `enabled: false` with no API
 * call (moment bookmarks made in the player are the only ones kept locally).
 */
export function useVideoBookmarks() {
  const { isAuthenticated } = useAuth();
  const [idsByVideo, setIdsByVideo] = useState<Map<number, number[]>>(new Map());
  const busy = useRef<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setIdsByVideo(new Map());
        return;
      }
      let cancelled = false;
      (async () => {
        const res = await videoBookmarkService.list();
        if (cancelled || !res.success || !res.data) return;
        setIdsByVideo(groupWholeVideoBookmarks(res.data));
      })();
      return () => {
        cancelled = true;
      };
    }, [isAuthenticated]),
  );

  const isBookmarked = useCallback((videoId: number) => idsByVideo.has(videoId), [idsByVideo]);

  const toggle = useCallback(
    async (videoId: number) => {
      if (busy.current.has(videoId)) return;
      busy.current.add(videoId);
      const previous = idsByVideo.get(videoId);
      const set = (ids: number[] | undefined) =>
        setIdsByVideo((prev) => {
          const next = new Map(prev);
          if (ids) next.set(videoId, ids);
          else next.delete(videoId);
          return next;
        });
      set(previous ? undefined : [PENDING_ID]); // optimistic
      try {
        if (previous) {
          // Remove every whole-video bookmark of this video (another device
          // may have created a second one), so the icon really turns off.
          const results = await Promise.all(previous.map((id) => videoBookmarkService.remove(id)));
          if (results.some((r) => !r.success)) set(previous);
        } else {
          const res = await videoBookmarkService.add({ videoId, positionSeconds: 0 });
          if (res.success && res.data) set([res.data.id]);
          else set(undefined);
        }
      } catch {
        set(previous);
      } finally {
        busy.current.delete(videoId);
      }
    },
    [idsByVideo],
  );

  return { enabled: isAuthenticated, isBookmarked, toggle };
}
