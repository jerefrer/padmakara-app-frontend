import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { isSplashLifted, subscribeSplashLift } from '@/utils/splashHandoff';

/** Same as the native splash fade set in the root layout (SplashScreen.setOptions). */
const FADE_MS = 350;

/**
 * Android only. The Android 12+ native splash can only show the dharma wheel, masked to a circle,
 * so this cover shows the full lockup (the iOS splash: wheel, "PADMAKARA", "RAMO LUSÓFONO" on
 * burgundy) from the first render of the root layout. Once it has painted it hides the native
 * splash, whose own fade cross-fades the wheel into the cover. liftSplash (utils/splashHandoff)
 * then fades the cover out where the native splash used to be lifted. Decorative, so hidden
 * from screen readers.
 */
export function SplashCover() {
  if (Platform.OS !== 'android') return null;
  return <AndroidSplashCover />;
}

function AndroidSplashCover() {
  const [mounted, setMounted] = useState(true);
  const [painted, setPainted] = useState(false);
  const [lifted, setLifted] = useState(isSplashLifted);
  const opacity = useRef(new Animated.Value(1)).current;
  const laidOutRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeSplashLift(() => setLifted(true));
    // Lifted between the first render and this subscription.
    if (isSplashLifted()) setLifted(true);
    return unsubscribe;
  }, []);

  // Laid out, then one more frame so the native splash is not removed before the cover shows.
  const onLayout = useCallback(() => {
    if (laidOutRef.current) return;
    laidOutRef.current = true;
    requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => undefined);
      setPainted(true);
    });
  }, []);

  // Fade only after the native splash is gone, even when the lift came first.
  useEffect(() => {
    if (!painted || !lifted) return;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() =>
      setMounted(false),
    );
  }, [painted, lifted, opacity]);

  if (!mounted) return null;

  return (
    <Animated.View
      testID="splash-cover"
      onLayout={onLayout}
      pointerEvents={lifted ? 'none' : 'auto'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.cover, { opacity }]}
    >
      <Image source={require('../assets/images/splash.png')} style={styles.logo} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#9b1b1b',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  // The native splash's imageWidth (app.config.ts) at splash.png's 1800 x 1766 ratio. Both sides are
  // explicit: with aspectRatio alone, Image takes the file's height (1766) and Yoga derives the
  // width from it, so the lockup drew at 1800 dp.
  logo: { width: 290, height: (290 * 1766) / 1800 },
});
