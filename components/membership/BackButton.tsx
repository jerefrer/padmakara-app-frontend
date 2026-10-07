import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipColors as c, fonts } from './theme';
import { tr } from './tr';

/**
 * Back control for every membership screen: "‹ Back" as plain burgundy text in the display
 * font, no box (the `.back` of the membership mockup).
 */
interface Props {
  /** Text after the "‹"; defaults to "Back". */
  label?: string;
  /** Where to go when there is no history to go back to (a reload). */
  fallback?: string;
  /** Wider row, for the two-column pay screen. */
  wide?: boolean;
}

export function BackButton({ label, fallback = '/(tabs)', wide = false }: Props = {}) {
  const { t } = useLanguage();
  const text = label ?? tr(t, 'back', 'Back');
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as any);
  };
  return (
    <View style={[styles.row, wide && styles.rowWide]}>
      <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={goBack} style={styles.button}>
        <Text style={styles.text}>{`‹ ${text}`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20 },
  rowWide: { maxWidth: 960 },
  button: { alignSelf: 'flex-start', paddingVertical: 8 },
  text: { fontSize: 16, color: c.burgundy[500], fontFamily: fonts.display },
});
