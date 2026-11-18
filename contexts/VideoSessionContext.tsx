import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import type { EventVideo } from '@/types';

/** The video open in the app, with what its page shows around it. */
export interface VideoSession {
  video: EventVideo;
  /** The event the video belongs to. */
  eventId: string;
  /** The event's display title, shown before the video's own title. */
  eventTitle?: string;
  /** All the videos of the event, for the "other videos" list. */
  videos?: EventVideo[];
  /** Start here instead of at the saved position (opened from a video bookmark). */
  initialPositionSeconds?: number;
}

interface VideoSessionValue {
  session: VideoSession | null;
  /** The video plays in the small floating window instead of on its page. */
  minimized: boolean;
  /** Opens a video on its page; the one already open is replaced. */
  openVideo: (session: VideoSession) => void;
  /** Switches to another video of the same event. */
  selectVideo: (video: EventVideo) => void;
  minimize: () => void;
  expand: () => void;
  /** Ends the session: the player is released. */
  close: () => void;
  /** Whether cellular playback was accepted during this run of the app. */
  cellularAcceptedRef: React.MutableRefObject<boolean>;
}

const VideoSessionContext = createContext<VideoSessionValue | null>(null);

/**
 * Owns the open video above the navigator, the way AudioPlayerProvider owns
 * the track: the screen that opened a video can be left, and the same player
 * keeps playing in the floating window until the viewer closes it.
 */
export function VideoSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<VideoSession | null>(null);
  const [minimized, setMinimized] = useState(false);
  const cellularAcceptedRef = useRef(false);

  const openVideo = useCallback((next: VideoSession) => {
    setSession((current) => {
      // Reopening the video that is already open (its card tapped while it
      // floats) keeps the same object, so the player does not reload it.
      if (current && current.video.id === next.video.id && next.initialPositionSeconds === undefined) {
        return { ...next, video: current.video, initialPositionSeconds: current.initialPositionSeconds };
      }
      return next;
    });
    setMinimized(false);
  }, []);

  const selectVideo = useCallback((video: EventVideo) => {
    setSession((current) => (current ? { ...current, video, initialPositionSeconds: undefined } : current));
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);
  const close = useCallback(() => {
    setSession(null);
    setMinimized(false);
  }, []);

  const value = useMemo(
    () => ({ session, minimized, openVideo, selectVideo, minimize, expand, close, cellularAcceptedRef }),
    [session, minimized, openVideo, selectVideo, minimize, expand, close],
  );

  return <VideoSessionContext.Provider value={value}>{children}</VideoSessionContext.Provider>;
}

export function useVideoSession(): VideoSessionValue {
  const value = useContext(VideoSessionContext);
  if (!value) throw new Error('useVideoSession must be used within a VideoSessionProvider');
  return value;
}
