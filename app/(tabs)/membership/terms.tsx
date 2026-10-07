import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { BackButton } from '@/components/membership/BackButton';
import { membershipColors as c, fonts } from '@/components/membership/theme';
import { tr } from '@/components/membership/tr';

const SECTIONS = [
  ['termsContributionHeading', 'Contribution', 'termsContributionBody'],
  ['termsRenewalHeading', 'Renewal', 'termsRenewalBody'],
  ['termsCancellationHeading', 'Cancellation', 'termsCancellationBody'],
  ['termsRefundsHeading', 'Refunds', 'termsRefundsBody'],
  ['termsWhoHeading', 'Who we are', 'termsWhoBody'],
] as const;

const FALLBACK_BODY: Record<string, string> = {
  termsContributionBody:
    'Membership is a voluntary contribution that keeps the teachings available. You choose the amount, from €5 a month or €60 a year, up to €1000, and you can change it at any time. The new amount applies from your next payment.',
  termsRenewalBody:
    'Your membership renews automatically every month or every year, depending on what you chose, until you cancel. Payments are taken by card or Direct Debit through our payment provider.',
  termsCancellationBody:
    'You can cancel at any time from your membership page. You keep full access until the end of the period you already paid for, and no further payments are taken. You can resume before that date.',
  termsRefundsBody: '[[Refund policy to confirm]]',
  termsWhoBody:
    'Membership is offered by [[Legal name of the association]], NIF [[NIF]], [[Address]]. Questions: [[Contact email]].',
};

export default function MembershipTerms() {
  // Pricing and terms are web-only (Apple reader-app rule); nothing to show on native.
  if (Platform.OS !== 'web') return <Redirect href={'/(tabs)' as any} />;
  return <TermsPage />;
}

function TermsPage() {
  const { t } = useLanguage();
  return (
    <ScrollView style={styles.screen}>
      <BackButton />
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          {tr(t, 'termsTitle', 'Membership terms')}
        </Text>
        <View style={styles.draft}>
          <Text style={styles.draftText}>
            {tr(t, 'termsDraft', 'Draft — to be completed by Padmakara before launch.')}
          </Text>
        </View>
        {SECTIONS.map(([heading, headingFallback, body]) => (
          <View key={heading} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {tr(t, heading, headingFallback)}
            </Text>
            <Text style={styles.body}>{tr(t, body, FALLBACK_BODY[body])}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream[100] },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24, gap: 20 },
  title: { fontSize: 28, fontFamily: fonts.display, fontWeight: '600', color: c.burgundy[500] },
  draft: { backgroundColor: c.amber[50], borderRadius: 10, padding: 14, borderWidth: 1, borderColor: c.amber[700] },
  draftText: { fontSize: 15, color: c.amber[700], fontWeight: '600' },
  section: { gap: 6 },
  heading: { fontSize: 20, fontFamily: fonts.display, fontWeight: '600', color: c.gray[800] },
  body: { fontSize: 16, lineHeight: 24, color: c.gray[700] },
});
