import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipService } from '@/services/membershipService';
import { MAX_AMOUNT, MIN_AMOUNT, formatEuro, type MembershipInterval } from '@/utils/membership';
import { AmountPicker, choiceAmount, defaultChoice, type AmountChoice } from './AmountPicker';
import { space } from './pageStyles';
import { membershipErrorMessage } from './errorMessage';
import { membershipColors as c, fonts } from './theme';
import { tr } from './tr';
import { useFocusRing } from './focusRing';
import { payHref } from './payRoute';

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
  // One memory per interval, so switching tabs never loses what was chosen on the other one.
  const [choices, setChoices] = useState<Record<MembershipInterval, AmountChoice>>({
    month: defaultChoice('month'),
    year: defaultChoice('year'),
  });
  const choice = choices[interval];
  const amount = choiceAmount(choice, interval);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseInterval = (next: MembershipInterval) => {
    if (next === interval) return;
    setInterval(next);
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
      if (res.success && res.data?.checkout?.id && res.data.checkout.session) {
        onJoined?.(res.data.url);
        router.push(payHref(res.data, { amount, interval }) as any);
        return;
      }
      if (res.success) {
        setError(tr(t, 'errGeneric', 'Something went wrong. Please try again.'));
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
      ? tr(t, 'detailMonth', 'Renews automatically, cancel anytime from your account.')
      : tr(t, 'detailYear', 'Paid once a year, cancel anytime from your account.');

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {tr(t, 'joinTitle', 'Become a Member')}
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

      <Text testID="join-quote" style={styles.quote}>
        {tr(
          t,
          'why',
          'Your contribution keeps the teachings available. It funds recording and archiving, and also translation, transcription and the retreats themselves.',
        )}
      </Text>

      <View testID="join-tabs" style={styles.tabs} accessibilityRole="tablist">
        {(['month', 'year'] as const).map((i) => (
          <IntervalTab key={i} interval={i} selected={interval === i} onPress={() => chooseInterval(i)}>
            {i === 'month' ? tr(t, 'monthly', 'Monthly') : tr(t, 'yearly', 'Yearly')}
          </IntervalTab>
        ))}
      </View>

      <Text testID="join-label" style={styles.sectionLabel}>{tr(t, 'contributionLabel', 'Your contribution')}</Text>
      <AmountPicker
        key={interval}
        interval={interval}
        choice={choice}
        onChoice={(next) => setChoices((prev) => ({ ...prev, [interval]: next }))}
      />

      {summary && (
        <Text testID="join-summary" style={styles.summary}>
          <Text style={styles.summaryBig}>{summary}.</Text> {detail}
        </Text>
      )}

      <Pressable
        testID="join-continue"
        accessibilityRole="button"
        accessibilityState={{ disabled: amount === null || busy }}
        disabled={amount === null || busy}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          (amount === null || busy) && styles.buttonOff,
        ]}
        onPress={onContinue}
      >
        <Text style={styles.buttonText}>{tr(t, 'continue', 'Continue to payment')}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text testID="join-fine" style={styles.fine}>
        {tr(t, 'finePrint', 'By continuing you accept the')}{' '}
        <Text style={styles.link} onPress={() => router.push('/membership/terms' as any)}>
          {tr(t, 'termsLink', 'membership terms')}
        </Text>
        .
      </Text>
    </View>
  );
}

function IntervalTab({
  interval,
  selected,
  onPress,
  children,
}: {
  interval: MembershipInterval;
  selected: boolean;
  onPress: () => void;
  children: string;
}) {
  const ring = useFocusRing();
  return (
    <Pressable
      testID={`interval-tab-${interval}`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[styles.tab, selected && styles.tabOn, ring.style]}
      onPress={onPress}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
    >
      <Text style={[styles.tabText, selected && styles.tabTextOn]}>{children}</Text>
    </Pressable>
  );
}

// Page title, section label and primary button reuse the look of app/(tabs)/settings.tsx
// (desktopPageTitle, sectionTitleOutside, signInButton).
const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 30,
    fontFamily: 'MinionPro',
    color: c.burgundy[500],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
    marginTop: 24,
  },
  banner: { borderLeftWidth: 2, borderLeftColor: c.amber[700], paddingLeft: 12, marginTop: space.title },
  bannerText: { fontSize: 15, lineHeight: 22, color: c.amber[700] },
  quote: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: 'EBGaramond_400Regular_Italic',
    fontStyle: 'italic',
    color: c.gray[800],
    borderLeftWidth: 2,
    borderLeftColor: c.burgundy[500],
    paddingLeft: 12,
    marginTop: space.title,
  },
  tabs: { marginTop: space.block, flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderBottomColor: c.gray[200] },
  tab: { paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: c.burgundy[500] },
  tabText: { fontSize: 18, fontFamily: fonts.display, fontVariant: ['small-caps'], letterSpacing: 0.7, color: c.gray[600] },
  tabTextOn: { color: c.burgundy[500] },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: space.block,
    marginBottom: space.tight,
  },
  summary: { marginTop: space.block, fontSize: 14, lineHeight: 21, color: c.gray[600] },
  summaryBig: { fontSize: 19, fontFamily: fonts.display, fontWeight: '600', color: c.gray[800] },
  button: {
    marginTop: space.action,
    alignSelf: 'flex-start',
    backgroundColor: c.burgundy[500],
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 2,
  },
  buttonPressed: { backgroundColor: c.burgundy[600] },
  buttonOff: { backgroundColor: c.gray[300] },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600', fontFamily: 'EBGaramond_600SemiBold' },
  error: { marginTop: space.fine, fontSize: 14, color: c.red[700] },
  fine: { marginTop: space.fine, fontSize: 13, color: c.gray[500], lineHeight: 19 },
  link: { color: c.burgundy[500], textDecorationLine: 'underline' },
});
