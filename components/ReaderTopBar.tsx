import React, { useEffect } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FADE_MS = 200;

interface ReaderTopBarProps {
  hidden: boolean;
  children: React.ReactNode;
  /** Pad below the status bar; off inside a sheet that already clears it. */
  clearStatusBar?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A document reader's top bar, laid over the page and faded in and out.
 *
 * The document underneath keeps its size when the bar hides: resizing the
 * native PDF view in an animation crashed PDFKit on iOS 27 (its page
 * analysis threw while the visible pages changed under it), and the page no
 * longer jumps when the bar comes and goes. The web has no reader mode, so
 * there the bar stays in the layout above the document. Render it before the
 * document.
 */
export function ReaderTopBar({ hidden, children, clearStatusBar = true, style }: ReaderTopBarProps) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(hidden ? 0 : 1);

  useEffect(() => {
    opacity.value = withTiming(hidden ? 0 : 1, { duration: FADE_MS });
  }, [hidden, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID="reader-top-bar"
      pointerEvents={hidden ? 'none' : 'box-none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[styles.bar, clearStatusBar && { paddingTop: insets.top }, style, fade]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar:
    Platform.OS === 'web'
      ? {}
      : {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          elevation: 4,
        },
});
