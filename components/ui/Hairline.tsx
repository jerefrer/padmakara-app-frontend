import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * The thinnest line the screen can draw, laid along the bottom edge of its parent (which must
 * not clip it and gives it its width).
 *
 * On the web the line is one DEVICE pixel tall: 1 / devicePixelRatio CSS pixels. The browser snaps
 * such a box to the pixel grid, so every line looks the same wherever it falls. (A 1px block scaled
 * by 0.5, as it used to be, is not snapped: on a standard screen a line at a half-pixel offset
 * smeared over two rows and looked thicker and paler than its neighbours.) Native draws
 * StyleSheet.hairlineWidth.
 */
function lineHeight(): number {
  if (Platform.OS !== "web") return StyleSheet.hairlineWidth;
  const ratio = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
  return 1 / ratio;
}

export function Hairline({ color, style, testID }: { color: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.line, { backgroundColor: color, height: lineHeight() }, style]}
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
  },
});
