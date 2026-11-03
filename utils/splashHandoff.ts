import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { appLockEnabledAtStart } from '@/services/appLock';

/**
 * Hands the native splash over to the first real screen.
 *
 * Lifting the splash as soon as fonts and caches are ready left a blank window for a few frames
 * (black in dark mode) while the start route redirected and the home drew. The splash now stays
 * until the home reports its first layout, then fades out (see SplashScreen.setOptions in the
 * root layout). The root layout still lifts it after a delay in case the app opens elsewhere.
 * With the app lock on at start, AppLockProvider owns the splash instead.
 *
 * Android's native splash can only show the wheel, so there a JS cover (components/SplashCover)
 * shows the full lockup from the first render and replaces it. Lifting the splash then means
 * fading that cover out, which it does when it hears about it through subscribeSplashLift.
 */

let lifted = false;
const liftListeners = new Set<() => void>();

/** True once the splash has been lifted (on Android: once the cover has been told to fade). */
export function isSplashLifted(): boolean {
  return lifted;
}

/** Calls `listener` when the splash is lifted. Returns the unsubscribe function. */
export function subscribeSplashLift(listener: () => void): () => void {
  liftListeners.add(listener);
  return () => {
    liftListeners.delete(listener);
  };
}

/** Lifts the splash once. Later calls do nothing. */
export function liftSplash(): void {
  if (lifted) return;
  lifted = true;
  if (Platform.OS === 'android') {
    liftListeners.forEach((listener) => listener());
    return;
  }
  SplashScreen.hideAsync().catch(() => undefined);
}

/** Tests only: forget that the splash was lifted and drop the listeners. */
export function __resetSplashHandoff(): void {
  lifted = false;
  liftListeners.clear();
}

/** Called by the first screen once laid out: lift the splash on the next frame, once it has painted. */
export function firstScreenDrawn(): void {
  if (lifted || appLockEnabledAtStart() === true) return;
  requestAnimationFrame(() => liftSplash());
}
