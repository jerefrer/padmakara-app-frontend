import React from 'react';
import { Platform } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { OutcomeLayout } from '@/components/membership/OutcomeLayout';
import { tr } from '@/components/membership/tr';

/** Screen 9: the payment form was closed without paying. */
export default function MembershipClosedScreen() {
  const { t } = useLanguage();
  if (Platform.OS !== 'web') return <Redirect href="/(tabs)" />;
  return (
    <OutcomeLayout
      showBack
      title={tr(t, 'closedTitle', 'No payment was made')}
      body={tr(t, 'closedBody', 'You can come back whenever you like.')}
      primary={{ label: tr(t, 'tryAgain', 'Try again'), onPress: () => router.replace('/membership' as any) }}
      secondary={{ label: tr(t, 'notNow', 'Not now'), onPress: () => router.replace('/(tabs)' as any) }}
    />
  );
}
