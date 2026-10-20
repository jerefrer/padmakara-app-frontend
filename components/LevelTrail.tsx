import React, { useSyncExternalStore } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { getHistory, subscribe } from '@/services/audioLevel';

const BURGUNDY = '#9b1b1b';
const MIN_BAR_HEIGHT = 1.5;
const OLDEST_OPACITY = 0.45;

// Shown when no real level exists (Android, web, sampling unavailable): a
// fixed, gentle profile with no animation at all.
const STATIC_PROFILE = [0.35, 0.5, 0.6, 0.45, 0.55, 0.4, 0.5];

interface LevelTrailProps {
  isPlaying: boolean;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function barLayout(size: number): { count: number; width: number; gap: number } {
  if (size >= 20) return { count: 7, width: 2, gap: 1 };
  if (size >= 16) return { count: 6, width: 2, gap: 1 };
  return { count: 6, width: 1.5, gap: 1 };
}

/**
 * Rolling level indicator: the newest loudness enters on the right and older
 * ones scroll left, fading. Without a real level it shows a still profile.
 * `isPlaying` is kept for call-site compatibility; motion itself is decided
 * by whether levels are being pushed (the player stops pushing on pause and
 * fades the history to the flat minimum).
 */
export function LevelTrail({ size = 16, color = BURGUNDY, style }: LevelTrailProps) {
  const history = useSyncExternalStore(subscribe, getHistory, getHistory);
  const { count, width, gap } = barLayout(size);

  const hasLevels = history.length > 0;
  const fractions = hasLevels
    ? Array.from({ length: count }, (_, i) => history[history.length - count + i] ?? 0)
    : STATIC_PROFILE.slice(0, count);

  return (
    <View style={[styles.container, { height: size, gap }, style]} testID="level-trail">
      {fractions.map((fraction, i) => (
        <View
          key={i}
          testID="level-trail-bar"
          style={{
            width,
            height: Math.max(MIN_BAR_HEIGHT, fraction * size),
            borderRadius: width / 2,
            backgroundColor: color,
            opacity: hasLevels ? OLDEST_OPACITY + ((1 - OLDEST_OPACITY) * i) / (count - 1) : 1,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
