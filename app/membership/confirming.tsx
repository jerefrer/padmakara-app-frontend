import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { OutcomeLayout } from '@/components/membership/OutcomeLayout';
import { useCheckoutStatus } from '@/components/membership/useCheckoutStatus';
import { membershipColors as c } from '@/components/membership/theme';
import { tr } from '@/components/membership/tr';

export default function ConfirmingScreen() {
  // Money screens are web-only; the app never shows prices or payment outcomes.
  if (Platform.OS !== 'web') return <Redirect href="/(tabs)" />;
  return <WebConfirming />;
}

function WebConfirming() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ checkout?: string | string[]; mode?: string | string[] }>();
  const checkout = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  // A card update charges nothing while access runs: no welcome, no receipt.
  const isUpdate = mode === 'update';
  const { phase } = useCheckoutStatus(checkout || undefined);

  const toMembership = () => router.replace('/membership' as any);
  const toTabs = () => router.replace('/(tabs)' as any);

  switch (phase) {
    case 'missing':
      return <Redirect href={'/membership' as any} />;

    case 'checking':
      return (
        <OutcomeLayout
          title={tr(t, 'confirmingTitle', 'Confirming your payment…')}
          body={tr(t, 'confirmingBody', 'This usually takes a few seconds. You can keep this page open.')}
        >
          <ActivityIndicator color={c.burgundy[500]} />
        </OutcomeLayout>
      );

    case 'active': {
      if (isUpdate) {
        return (
          <OutcomeLayout
            icon="✓"
            iconColor={c.green[700]}
            title={tr(t, 'methodUpdatedTitle', 'Payment method updated')}
            body={tr(t, 'methodUpdatedBody', 'Your next contributions will be taken with your new payment method.')}
            primary={{ label: tr(t, 'backToMembership', 'Back to my membership'), onPress: toMembership }}
          />
        );
      }
      const firstName = user?.name?.trim().split(/\s+/)[0];
      const email = user?.email;
      return (
        <OutcomeLayout
          icon="✓"
          iconColor={c.green[700]}
          title={tr(t, 'welcomeTitle', 'Welcome to Padmakara')}
          body={
            firstName
              ? tr(t, 'welcomeThanks', 'Thank you, {{name}}. Your membership is active.', { name: firstName })
              : tr(t, 'welcomeThanksAnon', 'Thank you. Your membership is active.')
          }
          primary={{ label: tr(t, 'goToRetreats', 'Go to my retreats'), onPress: toTabs }}
        >
          <View style={styles.ticks}>
            <Text style={styles.tick}>✓ {tr(t, 'welcomeTickRecordings', 'Recordings and transcripts of your retreats')}</Text>
            <Text style={styles.tick}>✓ {tr(t, 'welcomeTickApp', 'Listening on the iPhone app with the same account')}</Text>
            {email && (
              <Text style={styles.tick}>
                ✓ {tr(t, 'welcomeTickReceipt', 'A receipt has been sent to {{email}}', { email })}
              </Text>
            )}
          </View>
        </OutcomeLayout>
      );
    }

    case 'processing':
      return (
        <OutcomeLayout
          icon="⏳"
          title={tr(t, 'processingTitle', 'Your bank is processing the payment')}
          body={tr(
            t,
            'processingBody',
            "Direct Debit can take a few days to clear. We'll email you as soon as your membership is active, and the recordings will unlock by themselves.",
          )}
          primary={{ label: tr(t, 'backToPadmakara', 'Back to Padmakara'), onPress: toTabs }}
        />
      );

    case 'failed':
      return (
        <OutcomeLayout
          title={tr(t, 'declinedTitle', 'Your payment was declined. Nothing was charged.')}
          primary={{ label: tr(t, 'tryAgain', 'Try again'), onPress: toMembership }}
        />
      );

    case 'timeout':
    default:
      return (
        <OutcomeLayout
          title={tr(t, 'timeoutTitle', "Still confirming. We'll email you as soon as it's done.")}
          primary={{ label: tr(t, 'seeMembership', 'See my membership'), onPress: toMembership }}
        />
      );
  }
}

const styles = StyleSheet.create({
  ticks: { alignSelf: 'stretch', gap: 8 },
  tick: { fontSize: 15, lineHeight: 22, color: c.gray[700] },
});
