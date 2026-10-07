import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipService } from '@/services/membershipService';
import { MAX_AMOUNT, MIN_AMOUNT, SUGGESTED, formatEuro, type MembershipInterval } from '@/utils/membership';
import { AmountPicker } from './AmountPicker';
import { membershipErrorMessage } from './errorMessage';
import { membershipColors as c, fonts } from './theme';
import { tr } from './tr';

interface Props {
  initialInterval?: MembershipInterval;
  onJoined?: (url: string) => void;
  /** Set when a first payment failed and was not retried: shows a reassuring banner. */
  lastPaymentFailedAt?: string | null;
}

export function JoinMembership({ initialInterval = 'month', onJoined, lastPaymentFailedAt }: Props) {
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';

  const [interval, setInterval] = useState<MembershipInterval>(initialInterval);
  const [amount, setAmount] = useState<number | null>(SUGGESTED[initialInterval][1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseInterval = (next: MembershipInterval) => {
    if (next === interval) return;
    setInterval(next);
    setAmount(SUGGESTED[next][1]);
    setError(null);
  };

  const onContinue = async () => {
    if (amount === null || busy) return;
    if (!isAuthenticated) {
      router.push({ pathname: '/(auth)/magic-link', params: { returnTo: '/membership' } } as any);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await membershipService.join(amount, interval, lang);
      if (res.success && res.data?.url) {
        onJoined?.(res.data.url);
        if (Platform.OS === 'web') window.location.href = res.data.url;
        return;
      }
      setError(
        membershipErrorMessage(t, res.code, {
          min: formatEuro(MIN_AMOUNT[interval], lang),
          max: formatEuro(MAX_AMOUNT, lang),
        }),
      );
    } catch {
      setError(tr(t, 'errGeneric', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const summary =
    amount === null
      ? null
      : interval === 'month'
        ? tr(t, 'summaryMonth', '{{amount}} every month', { amount: formatEuro(amount, lang) })
        : tr(t, 'summaryYear', '{{amount}} every year', { amount: formatEuro(amount, lang) });
  const detail =
    interval === 'month'
      ? tr(t, 'detailMonth', 'Renews automatically. Cancel anytime from your account.')
      : tr(t, 'detailYear', 'Paid once a year. Cancel anytime from your account.');

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {tr(t, 'title', 'Become a member')}
      </Text>

      {lastPaymentFailedAt && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {tr(
              t,
              'lastPaymentFailedBanner',
              "Your last payment didn't go through. Nothing was charged. You can try again with another card or bank account.",
            )}
          </Text>
        </View>
      )}

      <View style={styles.seg} accessibilityRole="radiogroup">
        {(['month', 'year'] as const).map((i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityState={{ selected: interval === i }}
            style={[styles.segBtn, interval === i && styles.segOn]}
            onPress={() => chooseInterval(i)}
          >
            <Text style={[styles.segText, interval === i && styles.segTextOn]}>
              {i === 'month' ? tr(t, 'monthly', 'Monthly') : tr(t, 'yearly', 'Yearly')}
            </Text>
          </Pressable>
        ))}
      </View>

      <AmountPicker key={interval} interval={interval} value={amount} onChange={setAmount} />

      <Text style={styles.why}>
        {tr(
          t,
          'why',
          'Your contribution keeps the teachings available. It funds recording and archiving, and also translation, transcription and the retreats themselves.',
        )}
      </Text>

      {summary && (
        <View style={styles.summary}>
          <Text style={styles.summaryBig}>{summary}</Text>
          <Text style={styles.summaryDetail}>{detail}</Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: amount === null || busy }}
        disabled={amount === null || busy}
        style={[styles.button, (amount === null || busy) && styles.buttonOff]}
        onPress={onContinue}
      >
        <Text style={styles.buttonText}>{tr(t, 'continue', 'Continue to payment')}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.fine}>
        {tr(t, 'finePrint', 'By continuing you accept the')}{' '}
        <Text style={styles.link} onPress={() => router.push('/membership/terms' as any)}>
          {tr(t, 'termsLink', 'membership terms')}
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, gap: 16 },
  title: { fontSize: 28, fontFamily: fonts.display, fontWeight: '600', color: c.burgundy[500] },
  banner: { backgroundColor: c.amber[50], borderRadius: 10, padding: 14, borderWidth: 1, borderColor: c.amber[700] },
  bannerText: { fontSize: 15, lineHeight: 22, color: c.amber[700] },
  seg: {
    flexDirection: 'row',
    backgroundColor: c.gray[100],
    borderRadius: 10,
    padding: 3,
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segOn: { backgroundColor: c.white },
  segText: { fontSize: 15, color: c.gray[600] },
  segTextOn: { color: c.burgundy[500], fontWeight: '600' },
  why: { fontSize: 15, lineHeight: 22, color: c.gray[600] },
  summary: { backgroundColor: c.burgundy[50], borderRadius: 10, padding: 16, gap: 4 },
  summaryBig: { fontSize: 22, fontFamily: fonts.display, fontWeight: '600', color: c.gray[800] },
  summaryDetail: { fontSize: 14, color: c.gray[600] },
  button: { backgroundColor: c.burgundy[500], borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonOff: { backgroundColor: c.gray[300] },
  buttonText: { color: c.white, fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, color: c.red[700] },
  fine: { fontSize: 13, color: c.gray[500], lineHeight: 19 },
  link: { color: c.burgundy[500], textDecorationLine: 'underline' },
});
