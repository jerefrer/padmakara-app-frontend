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
 */

let lifted = false;

/** Lifts the native splash once. Later calls do nothing. */
export function liftSplash(): void {
  if (lifted) return;
  lifted = true;
  SplashScreen.hideAsync().catch(() => undefined);
}

/** Called by the first screen once laid out: lift the splash on the next frame, once it has painted. */
export function firstScreenDrawn(): void {
  if (lifted || appLockEnabledAtStart() === true) return;
  requestAnimationFrame(() => liftSplash());
}
