import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { RULE_COLOR, RULE_RIGHT_INSET, RULE_THICKNESS } from "@/constants/layout";

/**
 * The red rule that opens a list or section, placed right under the page
 * header. It runs from the left screen edge to RULE_RIGHT_INSET (see
 * constants/layout.ts); rows below it are separated by thin dark hairlines.
 */
export function SectionRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.rule, style]} testID="section-rule" />;
}

const styles = StyleSheet.create({
  rule: {
    height: RULE_THICKNESS,
    marginRight: RULE_RIGHT_INSET,
    backgroundColor: RULE_COLOR,
  },
});
