import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipColors as c } from './theme';
import { tr } from './tr';

/**
 * Back control for the membership screens, which live outside the tabs and so have no tab bar.
 * Same look as the "‹" button on the magic-link screen (app/(auth)/magic-link.tsx).
 */
interface Props {
  /** A text link ("‹ Change amount") instead of the square "‹" button. */
  label?: string;
  /** Where to go when there is no history to go back to (a reload). */
  fallback?: string;
  /** Wider row, for the two-column pay screen. */
  wide?: boolean;
}

export function BackButton({ label, fallback = '/(tabs)', wide = false }: Props = {}) {
  const { t } = useLanguage();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as any);
  };
  const rowStyle = [styles.row, wide && styles.rowWide];
  if (label) {
    return (
      <View style={rowStyle}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={goBack} style={styles.linkButton}>
          <Text style={styles.linkText}>{`‹ ${label}`}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={rowStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr(t, 'back', 'Back')}
        onPress={goBack}
        style={styles.button}
      >
        <Text style={styles.text}>{'‹'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20 },
  rowWide: { maxWidth: 960 },
  linkButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  linkText: { fontSize: 16, color: c.gray[600], fontFamily: 'EBGaramond_600SemiBold' },
  button: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.gray[200],
  },
  text: { fontSize: 24, color: c.gray[600], fontWeight: '400', marginTop: -1 },
});
