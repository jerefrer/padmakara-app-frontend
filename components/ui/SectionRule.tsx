import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { RULE_COLOR, RULE_RIGHT_INSET, ruleThickness } from "@/constants/layout";

/**
 * The light red rule directly under a page title or section header. On a phone it
 * runs from the text's left edge to the right gutter (see constants/layout.ts); rows
 * below it are separated by light black lines (SUBDIVISION_COLOR).
 *
 * `contained`: the parent already pads the content (desktop columns), so the rule
 * fills it instead of adding its own gutters.
 */
export function SectionRule({
  style,
  contained,
}: {
  style?: StyleProp<ViewStyle>;
  contained?: boolean;
}) {
  return <View style={[styles.rule, { height: ruleThickness() }, !contained && styles.gutters, style]} testID="section-rule" />;
}

const styles = StyleSheet.create({
  rule: {
    backgroundColor: RULE_COLOR,
  },
  gutters: {
    marginRight: RULE_RIGHT_INSET,
  },
});
