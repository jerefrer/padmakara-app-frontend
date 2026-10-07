import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { BackButton } from '@/components/membership/BackButton';
import { EasypayCheckout } from '@/components/membership/EasypayCheckout';
import { pageStyles, space } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';
import { tr } from '@/components/membership/tr';
import { membershipService } from '@/services/membershipService';
import { formatLongDate } from '@/utils/dateFormat';
import type { MembershipInterval } from '@/utils/membership';

const TWO_COLUMNS_FROM = 860;

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v);

/** 12.5 -> "€12.50", the way the payment form will show it. */
function euroExact(amount: number, language: 'en' | 'pt'): string {
  const text = amount.toFixed(2);
  return language === 'pt' ? `${text.replace('.', ',')} €` : `€${text}`;
}

export default function MembershipPayScreen() {
  // Payment is web-only (Apple reader-app rule): a deep link on native must never show the form.
  if (Platform.OS !== 'web') return <Redirect href="/(tabs)" />;
  return <PayPage />;
}

function PayPage() {
  const { t, language } = useLanguage();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';
  const { width } = useWindowDimensions();
  const wide = width >= TWO_COLUMNS_FROM;
  const params = useLocalSearchParams<{
    id?: Param;
    session?: Param;
    amount?: Param;
    interval?: Param;
    mode?: Param;
    testing?: Param;
  }>();
  const [declined, setDeclined] = useState(false);
  const [fatal, setFatal] = useState(false);
  const [nextPayment, setNextPayment] = useState<string | null>(null);

  // Everything comes from the URL, so a browser reload shows the same form.
  const id = first(params.id);
  const session = first(params.session);
  const isUpdate = first(params.mode) === 'update';
  const testing = first(params.testing) !== '0';
  const interval: MembershipInterval | null =
    first(params.interval) === 'year' ? 'year' : first(params.interval) === 'month' ? 'month' : null;
  const rawAmount = Number(first(params.amount));
  const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : null;

  // API mock mode has no Easypay account: there is no form to show, so go on as if it succeeded.
  const mock = session === 'mock';
  useEffect(() => {
    if (mock && id) {
      router.replace(
        `/membership/confirming?checkout=${encodeURIComponent(id)}${isUpdate ? '&mode=update' : ''}` as any,
      );
    }
  }, [mock, id, isUpdate]);

  // Updating the card takes nothing now; say when the new card is first used, if we know.
  useEffect(() => {
    if (!isUpdate) return;
    let cancelled = false;
    membershipService
      .get()
      .then((res) => {
        if (!cancelled && res.success && res.data?.accessUntil) setNextPayment(res.data.accessUntil);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isUpdate]);

  const toMembership = () => router.replace('/membership' as any);

  if (mock && id) return null;

  if (!id || !session || fatal) {
    return (
      <ScrollView style={styles.screen}>
        <BackButton fallback="/membership" />
        <View style={styles.container}>
          <Text style={styles.message}>
            {fatal
              ? tr(t, 'payFatal', 'The payment form could not be loaded. Please try again.')
              : tr(t, 'payInvalidLink', 'This payment link is no longer valid.')}
          </Text>
          <Pressable accessibilityRole="button" style={styles.linkButton} onPress={toMembership}>
            <Text style={pageStyles.link}>{tr(t, 'payBackToMembership', 'Back to membership')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const confirming = `/membership/confirming?checkout=${encodeURIComponent(id)}${isUpdate ? '&mode=update' : ''}`;
  const orderLabel =
    interval === 'year' ? tr(t, 'orderYearly', 'Yearly contribution') : tr(t, 'orderMonthly', 'Monthly contribution');
  const sentence = isUpdate
    ? tr(t, 'payUpdateNote', 'Your new payment method applies from your next payment.')
    : interval === 'year'
      ? tr(t, 'payFirstYear', 'First payment today, then every year until you cancel.')
      : tr(t, 'payFirstMonth', 'First payment today, then every month until you cancel.');

  return (
    <ScrollView style={styles.screen}>
      <BackButton
        wide
        fallback="/membership"
        label={isUpdate ? tr(t, 'back', 'Back') : tr(t, 'changeAmount', 'Change amount')}
      />
      <View style={[styles.container, styles.containerWide]}>
        <Text style={styles.title} accessibilityRole="header">
          {tr(t, 'payTitle', 'Payment')}
        </Text>

        {!isUpdate && (
          <View style={styles.steps}>
            <Text style={styles.step}>{`1 ${tr(t, 'stepContribution', 'Contribution')}`}</Text>
            <Text style={styles.step}>{'›'}</Text>
            <Text style={[styles.step, styles.stepOn]}>{`2 ${tr(t, 'stepPayment', 'Payment')}`}</Text>
            <Text style={styles.step}>{'›'}</Text>
            <Text style={styles.step}>{`3 ${tr(t, 'stepConfirmation', 'Confirmation')}`}</Text>
          </View>
        )}

        <View style={[styles.columns, wide && styles.columnsWide]}>
          <View style={[styles.summaryColumn, wide && styles.column]}>
            <Text style={styles.sectionLabel}>{tr(t, 'payYourMembership', 'Your membership')}</Text>
            {!isUpdate && amount !== null && (
              <View style={styles.order}>
                <Text style={styles.orderLabel}>{orderLabel}</Text>
                <Text style={styles.orderAmount}>{euroExact(amount, lang)}</Text>
              </View>
            )}
            {isUpdate && nextPayment && (
              <View style={styles.order}>
                <Text style={styles.orderLabel}>{tr(t, 'rowNextPayment', 'Next payment')}</Text>
                <Text style={styles.orderAmount}>{formatLongDate(nextPayment, lang)}</Text>
              </View>
            )}
            <Text style={styles.sentence}>{sentence}</Text>
            <Text style={styles.link} onPress={() => router.push('/membership/terms' as any)} accessibilityRole="link">
              {tr(t, 'termsTitle', 'Membership terms')}
            </Text>
          </View>

          <View style={[styles.formColumn, wide && styles.column]}>
            {declined && (
              <Text style={styles.declined} accessibilityRole="alert">
                {tr(t, 'declinedTitle', 'Your payment was declined. Nothing was charged.')}
              </Text>
            )}
            <EasypayCheckout
              manifest={{ id, session }}
              testing={testing}
              language={lang}
              hideCart={isUpdate}
              onSuccess={() => router.replace(confirming as any)}
              onClose={() => router.replace((isUpdate ? '/membership' : '/membership/closed') as any)}
              onPaymentError={() => setDeclined(true)}
              onFatal={() => setFatal(true)}
            />
            <Text style={styles.secure}>
              {`🔒 ${tr(t, 'paySecure', 'Card details go to Easypay, never to Padmakara.')}`}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream[100] },
  container: pageStyles.container,
  containerWide: { maxWidth: 960 },
  title: pageStyles.title,
  sectionLabel: { ...pageStyles.sectionLabel, marginTop: 0, marginBottom: 0 },
  steps: { flexDirection: 'row', gap: 10, marginTop: 12 },
  // Same look as the settings section labels.
  step: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2, color: c.gray[500] },
  stepOn: { color: c.burgundy[500] },
  columns: { marginTop: space.block, gap: space.block },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  summaryColumn: { gap: 14 },
  formColumn: { gap: 12 },
  order: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.gray[200],
  },
  orderLabel: { fontSize: 16, color: c.gray[800] },
  orderAmount: { fontSize: 19, fontFamily: 'EBGaramond_600SemiBold', color: c.gray[800] },
  sentence: { fontSize: 14, lineHeight: 21, color: c.gray[600] },
  link: { fontSize: 13, color: c.burgundy[500], textDecorationLine: 'underline' },
  declined: { fontSize: 15, lineHeight: 22, color: c.red[700] },
  secure: { fontSize: 13, color: c.gray[500] },
  message: { ...pageStyles.body, marginTop: 24 },
  linkButton: { alignSelf: 'flex-start', paddingVertical: 12 },
});
