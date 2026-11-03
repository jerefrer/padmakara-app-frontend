import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the tab bar's content row, above the system inset. */
export const TAB_BAR_CONTENT_HEIGHT = 49;

/**
 * Total height of the mobile tab bar: content row plus the bottom safe-area
 * inset (iOS home indicator, Android 3-button/gesture navigation bar under
 * edge-to-edge). The tab bar sets this height and padding explicitly and every
 * bar that floats above it reads the same value, so they always line up.
 * Unlike `useBottomTabBarHeight` it also works outside the tab navigator
 * (MiniPlayer, the event screen's player).
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_CONTENT_HEIGHT + insets.bottom;
}
