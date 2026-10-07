import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BackButton } from './BackButton';
import { membershipColors as c, fonts } from './theme';

interface Props {
  icon?: string;
  iconColor?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  /** Show the back control above the card (terminal states only). */
  showBack?: boolean;
}

/** Shared centred card for the payment outcome screens. */
export function OutcomeLayout({ icon, iconColor = c.burgundy[500], title, body, children, primary, secondary, showBack = false }: Props) {
  return (
    <View style={styles.wrap}>
      {showBack && <BackButton />}
      <View style={styles.screen}>
        <View style={styles.card}>
          {icon && <Text style={[styles.icon, { color: iconColor }]}>{icon}</Text>}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {body && <Text style={styles.body}>{body}</Text>}
          {children}
          {primary && (
            <Pressable accessibilityRole="button" style={styles.primary} onPress={primary.onPress}>
              <Text style={styles.primaryText}>{primary.label}</Text>
            </Pressable>
          )}
          {secondary && (
            <Pressable accessibilityRole="button" style={styles.secondary} onPress={secondary.onPress}>
              <Text style={styles.secondaryText}>{secondary.label}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.cream[100] },
  screen: { flex: 1, backgroundColor: c.cream[100], justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', gap: 16 },
  icon: { fontSize: 40 },
  title: { fontSize: 26, fontFamily: fonts.display, fontWeight: '600', color: c.gray[800], textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, color: c.gray[600], textAlign: 'center' },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: c.burgundy[500],
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: c.white, fontSize: 16, fontWeight: '600' },
  secondary: { alignSelf: 'stretch', paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: c.burgundy[500], fontSize: 16 },
});
