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
export function BackButton() {
  const { t } = useLanguage();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  };
  return (
    <View style={styles.row}>
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
