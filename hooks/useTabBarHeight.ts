import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the tab bar's content row, above the system inset. */
export const TAB_BAR_CONTENT_HEIGHT = 49;

/**
 * Total height of the mobile tab bar: content row plus the bottom safe-area
 * inset (iOS home indicator, Android 3-button/gesture navigation bar under
 * edge-to-edge). The tab bar sets this height and padding explicitly and every
 * bar that floats above it reads the same value, so they always line up.
 * Unlike `useBottomTabBarHeight` it also works outside the tab navigator
 * (MiniPlayer, mounted at the tabs layout level).
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_CONTENT_HEIGHT + insets.bottom;
}

/**
 * How much of a tab screen's own area the tab bar covers, for bars and padding
 * placed inside a screen (the event screen's player). On iOS the bar is
 * absolute and floats over the screen, so it covers the whole bar height; on
 * Android and the web the navigator lays the screen out above the bar, so it
 * covers nothing. Using the full height there floated the player one tab bar
 * too high.
 */
export function useTabBarOverlap(): number {
  const height = useTabBarHeight();
  return Platform.OS === 'ios' ? height : 0;
}
