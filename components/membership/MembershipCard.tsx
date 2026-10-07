import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { pageStyles } from './pageStyles';
import { membershipColors as c } from './theme';
import { tr } from './tr';

/**
 * Web-only invitation on the home page for signed-in non-members: a section label, André's
 * sentence as a quote, a square button. Native (reader app) never renders it.
 */
export function MembershipCard() {
  const { t } = useLanguage();

  return (
    <View testID="membership-invite" style={styles.container}>
      <Text style={styles.sectionLabel}>{tr(t, 'manageTitle', 'Membership')}</Text>
      <Text style={styles.quote}>
        {tr(t, 'homeCardBody', 'Your contribution keeps the teachings available to everyone.')}
      </Text>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [pageStyles.button, pressed && pageStyles.buttonPressed]}
        onPress={() => router.push('/membership' as any)}
      >
        <Text style={pageStyles.buttonText}>{tr(t, 'title', 'Become a member')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  sectionLabel: { ...pageStyles.sectionLabel, marginTop: 0, marginBottom: 0 },
  quote: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: 'EBGaramond_400Regular_Italic',
    fontStyle: 'italic',
    color: c.gray[800],
    borderLeftWidth: 2,
    borderLeftColor: c.burgundy[500],
    paddingLeft: 12,
  },
});
