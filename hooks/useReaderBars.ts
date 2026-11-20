import { useCallback, useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { setReaderFullWindow, setReaderImmersive } from '@/utils/readerImmersive';

/** Below this short side a sideways window is a phone, where the bars eat the page. */
const PHONE_SHORT_SIDE = 600;

/**
 * Tap-to-hide bars for a document reader. While `active` (a document is open),
 * `toggleBars` hides the reader's own bars and, through `setReaderImmersive`,
 * the tab bar and mini player. A phone turned sideways hides them on its own
 * (a tap still brings them back) and turning it upright restores them.
 * Closing the document or leaving the screen brings everything back. The
 * bars fade over the page (see ReaderTopBar) rather than resizing it.
 */
export function useReaderBars(
  active: boolean,
  /** The reader takes the whole window: the desktop shell drops its sidebars while it is open. */
  options: { fullWindow?: boolean } = {},
): {
  barsHidden: boolean;
  toggleBars: () => void;
  /** A phone held sideways, where the bars hide on their own. */
  sideways: boolean;
} {
  const { width, height } = useWindowDimensions();
  const sideways = Platform.OS !== 'web' && width > height && height < PHONE_SHORT_SIDE;

  const [barsHidden, setBarsHidden] = useState(sideways);
  // Closing the document brings the bars back for the next one; turning the
  // phone resets them to what suits the new orientation.
  const [wasActive, setWasActive] = useState(active);
  const [wasSideways, setWasSideways] = useState(sideways);
  if (active !== wasActive) {
    setWasActive(active);
    setBarsHidden(active && sideways);
  }
  if (sideways !== wasSideways) {
    setWasSideways(sideways);
    setBarsHidden(sideways);
  }

  // Only the open reader speaks for the tab bar: a closed one on the same
  // screen must not clear it when the phone turns.
  useEffect(() => {
    if (!active) return;
    setReaderImmersive(barsHidden);
    return () => setReaderImmersive(false);
  }, [active, barsHidden]);

  const fullWindow = !!options.fullWindow;
  useEffect(() => {
    if (!active || !fullWindow) return;
    setReaderFullWindow(true);
    return () => setReaderFullWindow(false);
  }, [active, fullWindow]);

  const toggleBars = useCallback(() => {
    if (!active) return;
    setBarsHidden((hidden) => !hidden);
  }, [active]);

  return { barsHidden: active && barsHidden, toggleBars, sideways };
}
