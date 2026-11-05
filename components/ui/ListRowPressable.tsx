import React from 'react';
import { Platform, Pressable, type PressableProps, View } from 'react-native';

/**
 * Delay before a list row shows its pressed state on iOS/Android. A scroll
 * gesture is recognised within this window and cancels the press, so rows do
 * not flash while the user is scrolling. A tap released earlier still fires
 * onPress (React Native activates and deactivates the press on release).
 */
export const ROW_PRESS_DELAY_MS = 130;

/**
 * Spread on a TouchableOpacity that is a row inside a scrolling list.
 * Web keeps immediate feedback.
 */
export function getRowPressDelayProps(): { delayPressIn?: number } {
  return Platform.OS === 'web' ? {} : { delayPressIn: ROW_PRESS_DELAY_MS };
}

/**
 * Pressable for rows inside scrolling lists: native press feedback is delayed
 * by ROW_PRESS_DELAY_MS, web is unchanged. Use plain Pressable for standalone
 * buttons.
 */
export const ListRowPressable = React.forwardRef<React.ComponentRef<typeof View>, PressableProps>(
  function ListRowPressable(props, ref) {
    const delayProps = Platform.OS === 'web' ? {} : { unstable_pressDelay: ROW_PRESS_DELAY_MS };
    return <Pressable ref={ref} {...delayProps} {...props} />;
  },
);
