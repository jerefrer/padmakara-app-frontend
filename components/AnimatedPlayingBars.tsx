import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

let Animated: any;
let useSharedValue: any;
let useAnimatedStyle: any;
let withRepeat: any;
let withTiming: any;
let interpolate: any;
let Easing: any;
let reanimatedAvailable = false;

try {
  const reanimated = require('react-native-reanimated');
  Animated = reanimated.default;
  useSharedValue = reanimated.useSharedValue;
  useAnimatedStyle = reanimated.useAnimatedStyle;
  withRepeat = reanimated.withRepeat;
  withTiming = reanimated.withTiming;
  interpolate = reanimated.interpolate;
  Easing = reanimated.Easing;
  reanimatedAvailable = true;
} catch {
  // Reanimated not available (e.g. Expo Go with mismatched native modules)
}

const colors = {
  burgundy: {
    500: '#9b1b1b',
    600: '#7b1616',
  },
  saffron: {
    500: '#f59e0b',
  },
};

interface AnimatedPlayingBarsProps {
  isPlaying: boolean;
  size?: number;
  color?: string;
  style?: any;
}

// Static fallback when reanimated isn't available
function StaticPlayingBars({ size = 16, color = colors.burgundy[500], style }: AnimatedPlayingBarsProps) {
  const barWidth = Math.max(2, size * 0.15);
  const heights = [size * 0.5, size * 0.7, size * 0.6, size * 0.4];
  return (
    <View style={[styles.container, { height: size }, style]}>
      {heights.map((h, i) => (
        <View key={i} style={[styles.bar, { width: barWidth, height: h, backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function AnimatedPlayingBars(props: AnimatedPlayingBarsProps) {
  if (!reanimatedAvailable) {
    return <StaticPlayingBars {...props} />;
  }

  return <AnimatedPlayingBarsInner {...props} />;
}

function AnimatedPlayingBarsInner({
  isPlaying,
  size = 16,
  color = colors.burgundy[500],
  style
}: AnimatedPlayingBarsProps) {
  const bar1 = useSharedValue(0);
  const bar2 = useSharedValue(0);
  const bar3 = useSharedValue(0);
  const bar4 = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      bar1.value = withRepeat(
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }), -1, true
      );
      bar2.value = withRepeat(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }), -1, true
      );
      bar3.value = withRepeat(
        withTiming(1, { duration: 350, easing: Easing.inOut(Easing.ease) }), -1, true
      );
      bar4.value = withRepeat(
        withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }), -1, true
      );
    } else {
      bar1.value = withTiming(0, { duration: 200 });
      bar2.value = withTiming(0, { duration: 200 });
      bar3.value = withTiming(0, { duration: 200 });
      bar4.value = withTiming(0, { duration: 200 });
    }
  }, [isPlaying]);

  const bar1Style = useAnimatedStyle(() => ({
    height: interpolate(bar1.value, [0, 1], [size * 0.3, size]),
  }));
  const bar2Style = useAnimatedStyle(() => ({
    height: interpolate(bar2.value, [0, 1], [size * 0.5, size * 0.8]),
  }));
  const bar3Style = useAnimatedStyle(() => ({
    height: interpolate(bar3.value, [0, 1], [size * 0.4, size * 0.9]),
  }));
  const bar4Style = useAnimatedStyle(() => ({
    height: interpolate(bar4.value, [0, 1], [size * 0.2, size * 0.7]),
  }));

  const barWidth = Math.max(2, size * 0.15);

  return (
    <View style={[styles.container, { height: size }, style]}>
      <Animated.View style={[styles.bar, { width: barWidth, backgroundColor: color }, bar1Style]} />
      <Animated.View style={[styles.bar, { width: barWidth, backgroundColor: color }, bar2Style]} />
      <Animated.View style={[styles.bar, { width: barWidth, backgroundColor: color }, bar3Style]} />
      <Animated.View style={[styles.bar, { width: barWidth, backgroundColor: color }, bar4Style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  bar: {
    borderRadius: 1,
    marginHorizontal: 0.5,
  },
});
