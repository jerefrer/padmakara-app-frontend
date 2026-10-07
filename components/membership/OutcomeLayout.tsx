import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from './BackButton';
import { pageStyles } from './pageStyles';
import { membershipColors as c, fonts } from './theme';

interface Props {
  /** An Ionicons glyph name, drawn plain like the icons in Settings. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  /** Show the back control above the card (terminal states only). */
  showBack?: boolean;
}

/** Shared centred layout for the payment outcome screens. */
export function OutcomeLayout({ icon, iconColor = c.burgundy[500], title, body, children, primary, secondary, showBack = false }: Props) {
  return (
    <View style={styles.wrap}>
      {showBack && <BackButton />}
      <View style={styles.screen}>
        <View style={styles.card}>
          {icon && <Ionicons testID="outcome-icon" name={icon} size={40} color={iconColor} />}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {body && <Text style={styles.body}>{body}</Text>}
          {children}
          {primary && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
              onPress={primary.onPress}
            >
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
  title: { fontSize: 26, fontFamily: fonts.display, fontWeight: '600', color: c.gray[800], textAlign: 'center' },
  body: { ...pageStyles.body, color: c.gray[600], textAlign: 'center' },
  primary: { ...pageStyles.button, alignSelf: 'center' },
  primaryPressed: pageStyles.buttonPressed,
  primaryText: pageStyles.buttonText,
  secondary: { alignSelf: 'center', paddingVertical: 4 },
  secondaryText: pageStyles.link,
});
