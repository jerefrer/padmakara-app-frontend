import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { BackButton } from '@/components/membership/BackButton';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';
import { tr } from '@/components/membership/tr';

const SECTIONS = [
  ['termsContributionHeading', 'Benefactor members', 'termsContributionBody'],
  ['termsRenewalHeading', 'Renewal', 'termsRenewalBody'],
  ['termsCancellationHeading', 'Cancellation', 'termsCancellationBody'],
  ['termsRefundsHeading', 'Refunds', 'termsRefundsBody'],
  ['termsWhoHeading', 'Who we are', 'termsWhoBody'],
  ['termsDisputesHeading', 'Disputes', 'termsDisputesBody'],
] as const;

const FALLBACK_BODY: Record<string, string> = {
  termsContributionBody:
    'When you join, you become a benefactor member (associado benemérito) of Associação Padmakara, under Article 3(1)(b) of its statutes, without voting rights. You support the association with a regular donation of the amount you choose, from €5 a month or €60 a year, up to €1000, and you can change it at any time. The new amount applies from your next payment. The statutes give associates the right to receive the Association\'s publications, under the conditions set by the Board ([[article]]). By decision of the Board of [[date]], these include the recordings and transcripts of the retreats you are part of.',
  termsRenewalBody:
    'Your donation renews automatically every month or every year, as you chose, until you cancel. It is taken by card or Direct Debit through our payment provider.',
  termsCancellationBody:
    'You can cancel at any time from your membership page. You keep full access until the end of the period you already paid for, and no further payments are taken. You can resume before that date.',
  termsRefundsBody:
    'If you are charged the wrong amount or charged twice, write to info@padmakara.pt within 14 days of the payment and we will refund the amount taken in error, by the same payment method. [[To confirm: right of withdrawal within 14 days of joining]]',
  termsWhoBody:
    'Membership is offered by Associação Padmakara, a non-profit association, NIPC 518137449, Covão da Águia CCI 460, 8550-261 Monchique, Portugal. Questions: info@padmakara.pt, or +351 910 560 121 / +351 966 467 979 (weekdays, 10:00–18:00).',
  termsDisputesBody:
    'In case of a dispute, you may turn to CIMAAL — Centro de Informação, Mediação e Arbitragem de Conflitos de Consumo do Algarve, Edifício Ninho de Empresas, Estrada da Penha, 8005-131 Faro, www.consumidoronline.pt (Lei n.º 144/2015). More information on the Portal do Consumidor, www.consumidor.gov.pt.',
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
        <Text style={styles.draftText}>
          {tr(t, 'termsDraft', 'Draft — to be completed by Padmakara before launch.')}
        </Text>
        {SECTIONS.map(([heading, headingFallback, body]) => (
          <View key={heading}>
            <Text style={pageStyles.sectionLabel} accessibilityRole="header">
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
  container: pageStyles.container,
  title: pageStyles.title,
  draftText: { fontSize: 15, lineHeight: 22, color: c.amber[700], marginTop: 16 },
  body: pageStyles.body,
});
