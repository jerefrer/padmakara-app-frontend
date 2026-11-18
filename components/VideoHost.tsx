import React from 'react';
import { useWindowDimensions } from 'react-native';

import { useBottomBarsSpace } from '@/components/MiniPlayer';
import { VideoPlayer, type FloatingFrame } from '@/components/VideoPlayer';
import { useVideoSession } from '@/contexts/VideoSessionContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';

/** Height of the desktop player bar (DesktopPlayerBar) the window floats above. */
const DESKTOP_PLAYER_BAR_HEIGHT = 80;
const DESKTOP_FLOATING_WIDTH = 360;
const DESKTOP_MARGIN = 24;
const MOBILE_MARGIN = 12;
const MOBILE_MIN_WIDTH = 200;
const MOBILE_MAX_WIDTH = 320;

/**
 * Where the floating window sits: on a phone, at the right above the tab bar
 * and the audio bar when one shows; on a tablet or desktop, in the bottom
 * right corner above the player bar.
 */
function useFloatingFrame(): FloatingFrame {
  const { width } = useWindowDimensions();
  const { isMobile } = useDesktopLayout();
  const bottomBarsSpace = useBottomBarsSpace();
  if (!isMobile) {
    return {
      right: DESKTOP_MARGIN,
      bottom: DESKTOP_PLAYER_BAR_HEIGHT + DESKTOP_MARGIN,
      width: DESKTOP_FLOATING_WIDTH,
    };
  }
  return {
    right: MOBILE_MARGIN,
    bottom: bottomBarsSpace,
    width: Math.round(Math.min(MOBILE_MAX_WIDTH, Math.max(MOBILE_MIN_WIDTH, width * 0.5))),
  };
}

/**
 * Renders the open video above the navigator (mounted once, in the root
 * layout). Because it lives here and not in the event screen, navigating
 * inside the app never unmounts the player: leaving the video page moves the
 * same view into the floating window (or, on iOS, the system picture in
 * picture), and the player is released only when the viewer closes the video.
 */
export function VideoHost() {
  const {
    session,
    minimized,
    inSystemPip,
    selectVideo,
    minimize,
    enterSystemPip,
    expand,
    close,
    cellularAcceptedRef,
  } = useVideoSession();
  const floatingFrame = useFloatingFrame();
  if (!session) return null;
  // No onComplete: the video stays open when it counts as watched (97%).
  // Closing then cut the last minutes and, in iOS full screen, left a blank
  // white screen behind the native player.
  return (
    <VideoPlayer
      video={session.video}
      eventTitle={session.eventTitle}
      totalVideos={session.videos?.length}
      videos={session.videos}
      onSelectVideo={selectVideo}
      cellularAcceptedRef={cellularAcceptedRef}
      initialPositionSeconds={session.initialPositionSeconds}
      minimized={minimized}
      inSystemPip={inSystemPip}
      onMinimize={minimize}
      onSystemPip={enterSystemPip}
      onExpand={expand}
      onClose={close}
      floatingFrame={floatingFrame}
      teacherNames={session.teacherNames}
      artworkUrl={session.artworkUrl}
    />
  );
}
