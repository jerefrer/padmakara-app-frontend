import { useFonts } from 'expo-font';
import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
  EBGaramond_600SemiBold_Italic,
  EBGaramond_700Bold,
  EBGaramond_700Bold_Italic,
} from '@expo-google-fonts/eb-garamond';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import 'react-native-reanimated';
import '../global.css';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SignInProvider } from '@/components/auth/SignInProvider';
import { AppLockProvider } from '@/contexts/AppLockContext';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import { ensureCacheSchemaCurrent } from '@/services/cacheSchemaVersion';
import { cleanupLegacyWebCache } from '@/services/legacyCacheCleanup';
import syncService from '@/services/syncService';
import retreatService from '@/services/retreatService';
import { holdSplashWhile } from '@/utils/startup';
import { liftSplash } from '@/utils/splashHandoff';
import { appLockEnabledAtStart, readAppLockAtStart } from '@/services/appLock';
import { avenirFontsToLoad } from '@/constants/avenirFont';

// Keep the native splash (burgundy Padmakara lockup) on screen until fonts are
// loaded and the first screens' content is warm (see SPLASH_HOLD below).
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore — splash may already be hidden */
});
// Fade the splash into the first screen instead of cutting to it (iOS; Android fades by default).
SplashScreen.setOptions({ fade: true, duration: 350 });

/** If the app opens on a screen other than the home, the splash still lifts after this. */
const FIRST_SCREEN_TIMEOUT_MS = 1500;

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn ?? '',
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  beforeSend(event) {
    // Strip any email addresses that might leak through
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});

/**
 * The splash stays up at least long enough to be seen, and at most long
 * enough that a slow network never keeps anyone waiting behind it. The web
 * has no native splash — holding there is a blank page — so it only waits
 * briefly for the warm-up and never for show.
 */
const SPLASH_HOLD =
  Platform.OS === 'web' ? { minMs: 0, maxMs: 500 } : { minMs: 1000, maxMs: 2500 };

export default function RootLayout() {
  const [contentWarm, setContentWarm] = useState(false);

  useEffect(() => {
    cleanupLegacyWebCache().catch((err) =>
      console.warn('[cache] legacy cleanup failed:', err),
    );
    // The schema check can wipe the cache, so the warm-up waits for it:
    // warming first would fill a mirror that is about to be cleared.
    // The app-lock flag is read here too, while the splash still hides the app.
    const warmUp = () =>
      Promise.all([
        readAppLockAtStart(),
        ensureCacheSchemaCurrent()
          .catch((err) => console.warn('[cache] schema check failed:', err))
          .then(() => retreatService.warmHomeContent()),
      ]);
    holdSplashWhile(warmUp, SPLASH_HOLD).then(() => setContentWarm(true));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        syncService.checkAndSync().catch((err) =>
          console.warn('[sync] foreground sync failed:', err),
        );
      }
    });
    return () => sub.remove();
  }, []);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    MinionPro: require('../assets/fonts/MinionPro-Regular.otf'),
    MinionPro_Italic: require('../assets/fonts/MinionPro-It.otf'),
    MinionPro_Medium: require('../assets/fonts/MinionPro-Medium.otf'),
    MinionPro_MediumItalic: require('../assets/fonts/MinionPro-MediumIt.otf'),
    MinionPro_Semibold: require('../assets/fonts/MinionPro-Semibold.otf'),
    MinionPro_SemiboldItalic: require('../assets/fonts/MinionPro-SemiboldIt.otf'),
    MinionPro_Bold: require('../assets/fonts/MinionPro-Bold.otf'),
    MinionPro_BoldItalic: require('../assets/fonts/MinionPro-BoldIt.otf'),
    ...avenirFontsToLoad,
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    EBGaramond_600SemiBold_Italic,
    EBGaramond_700Bold,
    EBGaramond_700Bold_Italic,
  });

  // The navigator mounts only once the content is warm, so the home screen's
  // first render reads a filled cache instead of showing a spinner.
  const ready = loaded && contentWarm;

  useEffect(() => {
    // The home lifts the splash once it has drawn (utils/splashHandoff). With the app lock on,
    // AppLockProvider lifts it once its cover is on screen.
    if (!ready || appLockEnabledAtStart() === true) return;
    const timer = setTimeout(liftSplash, FIRST_SCREEN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <Sentry.ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <AudioPlayerProvider>
            <AppLockProvider>
            <SignInProvider>
            <Stack>
            <Stack.Screen name="index" options={{ headerShown: false, title: "Padmakara" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="subscription/[...rest]" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
            <Stack.Screen name="delete-account" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
            <StatusBar style="dark" backgroundColor="#e8e6e3" />
            </SignInProvider>
            </AppLockProvider>
          </AudioPlayerProvider>
        </LanguageProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
