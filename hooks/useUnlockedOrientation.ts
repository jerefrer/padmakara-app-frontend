import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Lets the device rotate while `active` is true. The app is locked to portrait globally
 * (app.config.ts), so this unlocks and puts portrait back when `active` turns false or the
 * screen unmounts. Does nothing on web, where ScreenOrientation is a no-op.
 */
export function useUnlockedOrientation(active: boolean): void {
  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    ScreenOrientation.unlockAsync().catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, [active]);
}
