import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusRing } from '@/components/membership/focusRing';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Section title inside a settings page or pane: the look of every membership page title. */
export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={[pageStyles.title, styles.sectionTitle]} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** The small uppercase label above a run of rows. */
export function GroupLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={styles.groupLabel}>
      <Text style={styles.groupLabelText}>{children}</Text>
      {hint ? <Text style={styles.groupHint}>{hint}</Text> : null}
    </View>
  );
}

/** A run of hairline rows. */
export function Rows({ children }: { children: React.ReactNode }) {
  return <View style={styles.rows}>{children}</View>;
}

interface RowProps {
  testID?: string;
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Replaces the value and chevron (a switch, a segmented control). */
  right?: React.ReactNode;
}

/** One settings row: icon, title and subtitle on the left; value, control or chevron on the right. */
export function SettingsRow({ testID, icon, title, subtitle, value, onPress, danger, disabled, right }: RowProps) {
  const ring = useFocusRing();
  const tint = disabled ? c.gray[400] : danger ? c.red[700] : c.burgundy[500];
  const content = (
    <>
      <View style={styles.left}>
        {icon ? <Ionicons name={icon} size={20} color={tint} /> : null}
        <View style={[styles.text, !icon && styles.textBare]}>
          <Text style={[styles.title, danger && { color: tint }, disabled && styles.disabledText]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ?? (
        <View style={styles.right}>
          {value !== undefined ? <Text style={styles.value} numberOfLines={2}>{value}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={16} color={c.gray[400]} /> : null}
        </View>
      )}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value !== undefined ? `${title}, ${value}` : title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={({ pressed }) => [styles.row, pressed && pageStyles.rowPressed, disabled && styles.disabledRow, ring.style]}
    >
      {content}
    </Pressable>
  );
}

export function SwitchRow({
  testID,
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: Omit<RowProps, 'value' | 'onPress' | 'right' | 'danger'> & {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <SettingsRow
      testID={testID}
      icon={icon}
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          testID={testID ? `${testID}-switch` : undefined}
          accessibilityLabel={title}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          // iOS ignores trackColor.false for the fill: without ios_backgroundColor an
          // off switch is a white pill with a faint edge, hard to see on the page. The fill
          // follows the value because it peeks out as a gray rim around an on switch.
          trackColor={{ false: c.gray[400], true: c.burgundy[500] }}
          ios_backgroundColor={value ? c.burgundy[500] : c.gray[400]}
        />
      }
    />
  );
}

/** Two or three exclusive choices side by side (the app language). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => !on && onChange(o.value)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: 0, marginBottom: 8 },
  groupLabel: { marginTop: 32, marginBottom: 8 },
  // The membership label look, without its own margins: the wrapper above sets the spacing.
  groupLabelText: { ...(pageStyles.sectionLabel as object), marginTop: 0, marginBottom: 0 },
  groupHint: { fontSize: 13, color: c.gray[500], marginTop: 2 },
  rows: { borderTopWidth: 1, borderTopColor: c.gray[200] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.gray[200],
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  text: { flex: 1, marginLeft: 12 },
  textBare: { marginLeft: 0 },
  title: { fontSize: 16, fontWeight: '500', color: c.gray[800] },
  subtitle: { fontSize: 14, color: c.gray[500], marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth: '50%' },
  value: { fontSize: 14, color: c.gray[600], marginRight: 8, flexShrink: 1, textAlign: 'right' },
  disabledRow: { opacity: 0.6 },
  disabledText: { color: c.gray[400] },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: c.gray[300], borderRadius: 2, overflow: 'hidden' },
  segment: { paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  segmentOn: { backgroundColor: c.burgundy[500] },
  segmentText: { fontSize: 14, fontWeight: '600', color: c.gray[700] },
  segmentTextOn: { color: c.white },
});
