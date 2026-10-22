import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { RULE_RIGHT_INSET, TEXT_GUTTER } from "@/constants/layout";

const colors = {
  burgundy500: "#9b1b1b",
  gray200: "#e5e7eb",
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
   * Full-width mobile screens: the thin line starts at the left edge and stops
   * at RULE_RIGHT_INSET, the first tab sits at the text gutter. Leave off when
   * the parent already provides the bleed (event page) or on desktop.
   */
  bleed?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Content shown at the right end of the row (e.g. a language filter). */
  trailing?: React.ReactNode;
}

/**
 * The one tab style of the app, taken from the event page's VIDEOS / AUDIO /
 * DOCUMENTS tabs: uppercase 13px semi-bold label, red 2px underline on the
 * active tab, thin gray line under the whole row.
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
    <View style={[styles.bar, bleed && styles.bleed, style]}>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    marginTop: 4,
    marginBottom: 12,
  },
  bleed: {
    paddingLeft: TEXT_GUTTER,
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
