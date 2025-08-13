import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  interpolate,
  Easing
} from 'react-native-reanimated';

const colors = {
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
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

export function AnimatedPlayingBars({ 
  isPlaying, 
  size = 16, 
  color = colors.burgundy[500],
  style 
}: AnimatedPlayingBarsProps) {
  // Create animation values for each bar
  const bar1 = useSharedValue(0);
  const bar2 = useSharedValue(0);
  const bar3 = useSharedValue(0);
  const bar4 = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      // Start animations with different phases for each bar
      bar1.value = withRepeat(
        withTiming(1, { 
          duration: 300, 
          easing: Easing.inOut(Easing.ease) 
        }), 
        -1, 
        true
      );
      
      bar2.value = withRepeat(
        withTiming(1, { 
          duration: 400, 
          easing: Easing.inOut(Easing.ease) 
        }), 
        -1, 
        true
      );
      
      bar3.value = withRepeat(
        withTiming(1, { 
          duration: 350, 
          easing: Easing.inOut(Easing.ease) 
        }), 
        -1, 
        true
      );
      
      bar4.value = withRepeat(
        withTiming(1, { 
          duration: 450, 
          easing: Easing.inOut(Easing.ease) 
        }), 
        -1, 
        true
      );
    } else {
      // Stop animations and return to baseline
      bar1.value = withTiming(0, { duration: 200 });
      bar2.value = withTiming(0, { duration: 200 });
      bar3.value = withTiming(0, { duration: 200 });
      bar4.value = withTiming(0, { duration: 200 });
    }
  }, [isPlaying]);

  // Create animated styles for each bar
  const bar1Style = useAnimatedStyle(() => {
    const height = interpolate(bar1.value, [0, 1], [size * 0.3, size]);
    return {
      height,
    };
  });

  const bar2Style = useAnimatedStyle(() => {
    const height = interpolate(bar2.value, [0, 1], [size * 0.5, size * 0.8]);
    return {
      height,
    };
  });

  const bar3Style = useAnimatedStyle(() => {
    const height = interpolate(bar3.value, [0, 1], [size * 0.4, size * 0.9]);
    return {
      height,
    };
  });

  const bar4Style = useAnimatedStyle(() => {
    const height = interpolate(bar4.value, [0, 1], [size * 0.2, size * 0.7]);
    return {
      height,
    };
  });

  const barWidth = Math.max(2, size * 0.15);
  const containerHeight = size;

  return (
    <View style={[styles.container, { height: containerHeight }, style]}>
      <Animated.View 
        style={[
          styles.bar, 
          { 
            width: barWidth, 
            backgroundColor: color 
          }, 
          bar1Style
        ]} 
      />
      <Animated.View 
        style={[
          styles.bar, 
          { 
            width: barWidth, 
            backgroundColor: color 
          }, 
          bar2Style
        ]} 
      />
      <Animated.View 
        style={[
          styles.bar, 
          { 
            width: barWidth, 
            backgroundColor: color 
          }, 
          bar3Style
        ]} 
      />
      <Animated.View 
        style={[
          styles.bar, 
          { 
            width: barWidth, 
            backgroundColor: color 
          }, 
          bar4Style
        ]} 
      />
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