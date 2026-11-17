import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * The thinnest line the screen can draw, laid along the bottom edge of its parent (which must
 * not clip it and gives it its width).
 *
 * Chrome computes any border under 1px as a full CSS pixel, so a 0.5px border is two device
 * pixels on a high-density screen. On the web the line is therefore a 1px block scaled to half
 * its height: one device pixel on a Retina screen, a lighter single pixel on a standard one.
 * Native draws StyleSheet.hairlineWidth.
 */
export function Hairline({ color, style, testID }: { color: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.line, { backgroundColor: color }, style]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    ...(Platform.OS === "web"
      ? { height: 1, transform: [{ scaleY: 0.5 }], transformOrigin: "bottom" }
      : { height: StyleSheet.hairlineWidth }),
  },
});
