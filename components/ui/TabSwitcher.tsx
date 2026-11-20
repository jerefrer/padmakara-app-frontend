import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { RULE_LEFT_INSET, RULE_COLOR, RULE_RIGHT_INSET, SUBDIVISION_THICKNESS } from "@/constants/layout";

const colors = {
  burgundy500: "#9b1b1b",
  gray500: "#6b7280",
};

export interface TabItem<K extends string = string> {
  key: K;
  label: string;
  testID?: string;
}

interface TabSwitcherProps<K extends string> {
  tabs: TabItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  /**
   * Full-width mobile screens: the line runs from the text gutter to
   * RULE_RIGHT_INSET. Leave off when the parent already pads the content
   * (event page, desktop).
   */
  bleed?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Content shown at the right end of the row (e.g. a language filter). */
  trailing?: React.ReactNode;
}

/**
 * The one tab style of the app, taken from the event page's VIDEOS / AUDIO /
 * DOCUMENTS tabs: uppercase 13px semi-bold label, red 2px underline on the
 * active tab, light red line under the whole row (it sits under a header, so it is a RULE_COLOR line).
 */
export function TabSwitcher<K extends string>({
  tabs,
  activeKey,
  onChange,
  bleed,
  style,
  trailing,
}: TabSwitcherProps<K>) {
  return (
    <View style={[styles.bar, bleed && styles.bleed, style]} testID="tab-switcher">
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={tab.testID}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: SUBDIVISION_THICKNESS,
    borderBottomColor: RULE_COLOR,
    marginTop: 4,
    marginBottom: 12,
  },
  bleed: {
    marginLeft: RULE_LEFT_INSET,
    marginRight: RULE_RIGHT_INSET,
  },
  tabs: {
    flexDirection: "row",
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginRight: 28,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.burgundy500,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: colors.gray500,
    textTransform: "uppercase",
  },
  tabTextActive: {
    color: colors.burgundy500,
  },
});
