import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { publicationService } from '@/services/publicationService';
import type { DeviceOpenTimes } from '@/utils/publicationOrder';

/** The later time of each publication across two maps. */
function latestOf(a: DeviceOpenTimes, b: DeviceOpenTimes): DeviceOpenTimes {
  const merged: DeviceOpenTimes = { ...a };
  for (const [id, time] of Object.entries(b)) {
    merged[id] = Math.max(merged[id] ?? 0, time);
  }
  return merged;
}

/**
 * This device's record of when each publication was last opened, re-read
 * whenever the screen comes into focus, and the call that records a new open
 * (on the device, and on the server when signed in).
 */
export function usePublicationOpens(signedIn: boolean): {
  deviceOpenTimes: DeviceOpenTimes;
  recordOpen: (publicationId: string) => void;
} {
  const [deviceOpenTimes, setDeviceOpenTimes] = useState<DeviceOpenTimes>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      publicationService.getDeviceOpenTimes().then((stored) => {
        // Merged rather than replaced: an open recorded while this read was
        // in flight must not be lost.
        if (!cancelled) setDeviceOpenTimes((current) => latestOf(current, stored));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const recordOpen = useCallback(
    (publicationId: string) => {
      setDeviceOpenTimes((current) => ({ ...current, [publicationId]: Date.now() }));
      void publicationService.recordOpen(publicationId, { signedIn });
    },
    [signedIn],
  );

  return { deviceOpenTimes, recordOpen };
}
