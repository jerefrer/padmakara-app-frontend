import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const BURGUNDY = '#9b1b1b';

// Per-bar profile: the middle bars reach higher, and each bar runs at its own
// speed and starting delay so the five never move in lockstep (a gentle
// organic wave, in the manner of Apple's now-playing glyph).
const BARS = [
  { peak: 0.5, duration: 620, delay: 0 },
  { peak: 0.8, duration: 540, delay: 140 },
  { peak: 1, duration: 700, delay: 60 },
  { peak: 0.75, duration: 580, delay: 200 },
  { peak: 0.45, duration: 660, delay: 100 },
] as const;

export const PLAYING_INDICATOR_BAR_COUNT = BARS.length;

interface PlayingIndicatorProps {
  /** Animated while true; settles to short dots when false. */
  isPlaying: boolean;
  /** Height of the indicator in px (the tallest bar). */
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Decorative "now playing" indicator: thin rounded vertical bars growing up and
 * down from the middle. Driven only by `isPlaying`, never by the audio signal,
 * so it behaves the same on iOS, Android and web.
 *
 * Heights are animated on the JS driver (layout property). That is fine for
 * five tiny bars, and it keeps the bar caps fully round, which a scaleY
 * transform on the native driver would squash.
 *
 * The loops only run while the app is active. With the screen locked, audio
 * keeps the app alive and the JS-driven frames ran unthrottled: the JS thread
 * sat at 99% CPU and iOS killed the app after a couple of minutes
 * (cpu_resource_fatal in build 19).
 */
export function PlayingIndicator({
  isPlaying,
  size = 16,
  color = BURGUNDY,
  style,
}: PlayingIndicatorProps) {
  const barWidth = Math.max(1.5, Math.round(size * 0.14 * 2) / 2);
  const gap = Math.max(1, barWidth * 0.8);
  const minHeight = barWidth;

  const values = useRef(BARS.map(() => new Animated.Value(0))).current;
  const appActive = useAppActive();
  const animate = isPlaying && appActive;

  useEffect(() => {
    if (!animate) {
      const settle = Animated.parallel(
        values.map((v) =>
          Animated.timing(v, { toValue: 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        ),
      );
      settle.start();
      return () => settle.stop();
    }

    const loops = values.map((v, i) => {
      const { duration, delay } = BARS[i];
      const swing = (toValue: number) =>
        Animated.timing(v, { toValue, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: false });
      return Animated.loop(Animated.sequence([Animated.delay(delay), swing(1), swing(0)]));
    });
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [animate, values]);

  return (
    <View
      testID="playing-indicator"
      style={[styles.container, { height: size, gap }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {BARS.map((bar, i) => (
        <Animated.View
          key={i}
          testID="playing-indicator-bar"
          style={{
            width: barWidth,
            borderRadius: barWidth / 2,
            backgroundColor: color,
            height: values[i].interpolate({
              inputRange: [0, 1],
              outputRange: [minHeight, Math.max(minHeight, bar.peak * size)],
            }),
          }}
        />
      ))}
    </View>
  );
}

const isAway = (state: string | null | undefined) => state === 'background' || state === 'inactive';

/** Whether the app is in the foreground, following AppState changes. */
function useAppActive(): boolean {
  // 'unknown' (cold start on iOS) counts as active: only an explicit
  // background or inactive state pauses the bars.
  const [active, setActive] = useState(!isAway(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(!isAway(next)));
    return () => sub?.remove?.();
  }, []);
  return active;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
