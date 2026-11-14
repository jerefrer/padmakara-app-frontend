import { useCallback, useEffect, useState } from 'react';

import { setReaderImmersive } from '@/utils/readerImmersive';

/**
 * Tap-to-hide bars for a document reader. While `active` (a document is open),
 * `toggleBars` hides the reader's own bars and, through `setReaderImmersive`,
 * the tab bar and mini player. Closing the document or leaving the screen
 * brings everything back.
 */
export function useReaderBars(active: boolean): { barsHidden: boolean; toggleBars: () => void } {
  const [barsHidden, setBarsHidden] = useState(false);
  // Closing the document brings the bars back for the next one.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setBarsHidden(false);
  }

  useEffect(() => {
    setReaderImmersive(active && barsHidden);
  }, [active, barsHidden]);

  useEffect(() => () => setReaderImmersive(false), []);

  const toggleBars = useCallback(() => {
    if (active) setBarsHidden((hidden) => !hidden);
  }, [active]);

  return { barsHidden: active && barsHidden, toggleBars };
}
