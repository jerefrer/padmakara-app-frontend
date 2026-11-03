import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSignIn } from '@/components/auth/SignInProvider';
import { OutcomeLayout } from '@/components/membership/OutcomeLayout';
import { membershipColors as c } from '@/components/membership/theme';
import { tt } from '@/components/teachings/tt';
import { teachingService, type TeachingOrder } from '@/services/teachingService';
import { formatEuro } from '@/utils/membership';

const POLL_MS = 4000;

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v);

export default function TeachingDoneScreen() {
  // Payment outcomes are web-only; the native app never shows them.
  if (Platform.OS !== 'web') return <Redirect href="/(tabs)" />;
  return <DonePage />;
}

type State = { name: 'checking' } | { name: 'invalid' } | { name: 'order'; order: TeachingOrder };

function DonePage() {
  const { t, language } = useLanguage();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';
  const { isAuthenticated } = useAuth();
  const { openSignIn } = useSignIn();
  const params = useLocalSearchParams<{ id?: Param; order?: Param }>();
  const id = first(params.id);
  const orderId = first(params.order);
  const [state, setState] = useState<State>(orderId ? { name: 'checking' } : { name: 'invalid' });

  // Poll until the payment reaches a final state. A failed poll is never final: keep trying.
  useEffect(() => {
    if (!orderId) {
      setState({ name: 'invalid' });
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const res = await teachingService.order(orderId);
        if (stopped) return;
        if (res.success && res.data) {
          setState({ name: 'order', order: res.data });
          if (res.data.status !== 'pending') return;
        } else if (res.status === 404) {
          setState({ name: 'invalid' });
          return;
        }
      } catch {
        // transient: keep polling
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const toTeaching = () => router.replace((id ? `/get/${id}` : '/(tabs)') as any);

  if (state.name === 'invalid') {
    return (
      <OutcomeLayout
        title={tt(t, 'invalidOrder', 'This payment link is no longer valid.')}
        primary={id ? { label: tt(t, 'backToTeaching', 'Back to the recordings'), onPress: toTeaching } : undefined}
      />
    );
  }

  if (state.name === 'checking') {
    return (
      <OutcomeLayout
        title={tt(t, 'checkingTitle', 'Confirming your payment…')}
        body={tt(t, 'checkingBody', 'This usually takes a few seconds. You can keep this page open.')}
      >
        <ActivityIndicator color={c.burgundy[500]} />
      </OutcomeLayout>
    );
  }

  const { order } = state;

  if (order.status === 'paid') {
    const returnTo = `/(tabs)/(groups)/retreat/${order.eventId}`;
    return (
      <OutcomeLayout
        icon="checkmark-circle-outline"
        iconColor={c.green[700]}
        title={tt(t, 'paidTitle', 'Thank you')}
        body={tt(t, 'paidBody', 'The recordings are in your account.')}
        primary={
          isAuthenticated
            ? { label: tt(t, 'open', 'Open the recordings'), onPress: () => router.replace(returnTo as any) }
            : { label: tt(t, 'signIn', 'Sign in'), onPress: () => openSignIn({ returnTo }) }
        }
      />
    );
  }

  if (order.status === 'pending') {
    const mb = order.mbReference;
    return (
      <OutcomeLayout
        title={tt(t, 'pendingTitle', 'Waiting for your payment')}
        body={tt(t, 'pendingBody', "We'll email you when your payment is confirmed.")}
      >
        {mb && (
          <View style={styles.mb} testID="mb-reference">
            <MbRow label={tt(t, 'mbEntity', 'Entity')} value={mb.entity} />
            <MbRow label={tt(t, 'mbReference', 'Reference')} value={mb.reference} />
            <MbRow label={tt(t, 'mbAmount', 'Amount')} value={formatEuro(mb.amount, lang, { decimals: true })} />
          </View>
        )}
      </OutcomeLayout>
    );
  }

  return (
    <OutcomeLayout
      title={tt(t, 'failedTitle', 'Your payment was not completed. Nothing was charged.')}
      primary={{ label: tt(t, 'tryAgain', 'Try again'), onPress: toTeaching }}
    />
  );
}

function MbRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mbRow}>
      <Text style={styles.mbLabel}>{label}</Text>
      <Text style={styles.mbValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mb: { alignSelf: 'stretch', borderTopWidth: 1, borderColor: c.gray[200] },
  mbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: c.gray[200],
  },
  mbLabel: { fontSize: 16, color: c.gray[600] },
  mbValue: { fontSize: 18, fontFamily: 'EBGaramond_600SemiBold', color: c.gray[800] },
});
