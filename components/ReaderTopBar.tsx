import React, { useEffect, useRef } from 'react';
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
  /** The bar's height, hidden or not, so the document can open below it. */
  onHeightChange?: (height: number) => void;
}

/**
 * A document reader's top bar, laid over the page and faded in and out.
 *
 * The document underneath keeps its size when the bar hides: resizing the
 * native PDF view in an animation crashed PDFKit on iOS 27 (its page
 * analysis threw while the visible pages changed under it), and the page no
 * longer jumps when the bar comes and goes. Pass the height it reports to the
 * document's contentInsetTop so the document opens below the bar. The web has
 * no reader mode, so there the bar stays in the layout above the document.
 * Render it before the document.
 */
export function ReaderTopBar({ hidden, children, clearStatusBar = true, style, onHeightChange }: ReaderTopBarProps) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(hidden ? 0 : 1);
  const measured = useRef<number | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    opacity.value = withTiming(hidden ? 0 : 1, { duration: FADE_MS });
  }, [hidden, opacity]);

  // A bar that opened hidden (a phone held sideways) reports once it shows.
  useEffect(() => {
    if (hidden || reported.current || measured.current === null) return;
    reported.current = true;
    onHeightChange?.(measured.current);
  }, [hidden, onHeightChange]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Only the height of a shown bar counts. Hiding the bars also hides the
  // status bar, and on an iPad (or a phone without a notch) that shrinks the
  // bar by the status bar's height: reported, it changed the document's
  // inset, and every change of inset sent the native reader back to page 1.
  const handleLayout = (height: number) => {
    measured.current = height;
    if (hidden) return;
    reported.current = true;
    onHeightChange?.(height);
  };

  return (
    <Animated.View
      testID="reader-top-bar"
      pointerEvents={hidden ? 'none' : 'box-none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[styles.bar, clearStatusBar && { paddingTop: insets.top }, style, fade]}
      onLayout={onHeightChange ? (e) => handleLayout(e.nativeEvent.layout.height) : undefined}
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
          // A soft shadow under the bar lifts it off the white page. boxShadow
          // rather than elevation: same blur on iOS and Android (see barShadow).
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.14)',
        },
});
