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
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import 'react-native-reanimated';
import '../global.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';

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

export default function RootLayout() {
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
    Avenir: require('../assets/fonts/Avenir-Book.ttf'),
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    EBGaramond_600SemiBold_Italic,
    EBGaramond_700Bold,
    EBGaramond_700Bold_Italic,
  });

  if (!loaded) {
    return null;
  }

  return (
    <Sentry.ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <AudioPlayerProvider>
            <Stack>
            <Stack.Screen name="index" options={{ headerShown: false, title: "Padmakara" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="subscription" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
            <Stack.Screen name="delete-account" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
            <StatusBar style="dark" backgroundColor="#e8e6e3" />
          </AudioPlayerProvider>
        </LanguageProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
