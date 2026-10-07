import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { membershipService, type MembershipView } from '@/services/membershipService';
import { formatLongDate } from '@/utils/dateFormat';
import { formatEuro } from '@/utils/membership';
import { ChangeAmountModal } from './ChangeAmountModal';
import { membershipColors as c, fonts } from './theme';
import { tr } from './tr';

interface Props {
  membership: MembershipView;
  onChanged: () => void;
}

const OUTCOME_LABEL = {
  paid: ['historyPaid', 'Paid'],
  failed: ['historyFailed', 'Failed'],
  refunded: ['historyRefunded', 'Refunded'],
} as const;

export function ManageMembership({ membership, onChanged }: Props) {
  const { t, language } = useLanguage();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [changingAmount, setChangingAmount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { state, source, amount, interval, accessUntil, graceUntil, method, history } = membership;
  const date = (iso: string | null) => (iso ? formatLongDate(iso, language) : '');
  const generic = tr(t, 'errGeneric', 'Something went wrong. Please try again.');

  const run = async (call: () => Promise<{ success: boolean; error?: string }>, after: () => void) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await call();
      if (res.success) after();
      else setError(res.error || generic);
    } catch {
      setError(generic);
    } finally {
      setBusy(false);
    }
  };

  const updateMethod = () =>
    run(
      async () => {
        const res = await membershipService.updateMethod(lang);
        if (res.success && res.data?.url) {
          if (Platform.OS === 'web') window.location.href = res.data.url;
          return { success: true };
        }
        return { success: false, error: res.error };
      },
      () => {},
    );

  const contribution =
    amount === null
      ? null
      : interval === 'year'
        ? tr(t, 'perYear', '{{amount}} / year', { amount: formatEuro(amount, lang) })
        : tr(t, 'perMonth', '{{amount}} / month', { amount: formatEuro(amount, lang) });

  const paidWith = method
    ? method.type === 'direct_debit'
      ? tr(t, 'directDebit', 'Direct Debit')
      : [method.brand ?? 'Card', method.lastFour ? `•••• ${method.lastFour}` : null].filter(Boolean).join(' ')
    : null;

  const status =
    state === 'cancelled'
      ? { label: tr(t, 'statusEnds', 'Ends {{date}}', { date: date(accessUntil) }), tone: styles.statusMuted }
      : state === 'payment_failed'
        ? { label: `● ${tr(t, 'statusPaymentNeeded', 'Payment needed')}`, tone: styles.statusWarn }
        : { label: `● ${tr(t, 'statusActive', 'Active')}`, tone: styles.statusOk };

  const managedByUs = source !== 'easypay';
  const row = (k: string, v: string | null) =>
    v ? (
      <View style={styles.kvRow} key={k}>
        <Text style={styles.kvKey}>{k}</Text>
        <Text style={styles.kvVal}>{v}</Text>
      </View>
    ) : null;

  const actionRow = (label: string, onPress: () => void, danger = false) => (
    <Pressable accessibilityRole="button" style={styles.actionRow} onPress={onPress} disabled={busy}>
      <Text style={[styles.actionText, danger && styles.actionDanger]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
  const primaryButton = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" style={styles.primary} onPress={onPress} disabled={busy}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {tr(t, 'manageTitle', 'Your membership')}
      </Text>

      {state === 'payment_failed' && !managedByUs && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {tr(
              t,
              'failedBanner',
              "Your last payment didn't go through. Your access continues until {{date}}. Update your payment method to keep it.",
              { date: date(graceUntil) },
            )}
          </Text>
        </View>
      )}
      {state === 'payment_failed' && !managedByUs && primaryButton(tr(t, 'updateMethod', 'Update payment method'), updateMethod)}

      <View style={styles.card}>
        <Text style={[styles.status, status.tone]}>{status.label}</Text>
        {state === 'cancelled' && (
          <Text style={styles.cardNote}>
            {tr(t, 'cancelledNote', 'Your access continues until then. No further payments will be taken.')}
          </Text>
        )}
        {row(tr(t, 'rowContribution', 'Contribution'), contribution)}
        {state !== 'cancelled' && row(tr(t, 'rowNextPayment', 'Next payment'), date(accessUntil) || null)}
        {row(tr(t, 'rowPaidWith', 'Paid with'), paidWith)}
      </View>

      {managedByUs && (
        <Text style={styles.cardNote}>{tr(t, 'contactUs', 'Contact us to change your membership')}</Text>
      )}

      {!managedByUs && state === 'active' && (
        <View style={styles.actions}>
          {actionRow(tr(t, 'changeAmount', 'Change amount'), () => setChangingAmount(true))}
          {actionRow(tr(t, 'updateMethod', 'Update payment method'), updateMethod)}
          {actionRow(tr(t, 'cancelMembership', 'Cancel membership'), () => setConfirmingCancel(true), true)}
        </View>
      )}
      {!managedByUs &&
        state === 'cancelled' &&
        primaryButton(tr(t, 'resumeMembership', 'Resume membership'), () =>
          run(() => membershipService.resume(), onChanged),
        )}

      {error && <Text style={styles.error}>{error}</Text>}

      {history.length > 0 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>{tr(t, 'historyTitle', 'Payments')}</Text>
          {history.map((h, i) => {
            const [key, fallback] = OUTCOME_LABEL[h.outcome];
            const outcome = tr(t, key, fallback);
            return (
              <View style={styles.historyRow} key={`${h.date}-${i}`}>
                <Text style={styles.historyDate}>{date(h.date)}</Text>
                <Text style={styles.historyVal}>
                  {h.amount === null ? outcome : `${formatEuro(h.amount, lang)} · ${outcome}`}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <ConfirmationModal
        visible={confirmingCancel}
        title={tr(t, 'cancelTitle', 'Cancel your membership?')}
        message={tr(
          t,
          'cancelMessage',
          'You keep full access until {{date}}, the end of the period you already paid for. No further payments will be taken.',
          { date: date(accessUntil) },
        )}
        buttons={[
          { text: tr(t, 'keepMembership', 'Keep my membership'), style: 'cancel' },
          {
            text: tr(t, 'cancelMembership', 'Cancel membership'),
            style: 'destructive',
            onPress: () => {
              run(() => membershipService.cancel(), onChanged);
            },
          },
        ]}
        onClose={() => setConfirmingCancel(false)}
      />

      <ChangeAmountModal
        visible={changingAmount}
        interval={interval ?? 'month'}
        currentAmount={amount}
        nextPaymentDate={date(accessUntil) || null}
        onClose={() => setChangingAmount(false)}
        onSaved={() => {
          setChangingAmount(false);
          onChanged();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, gap: 16 },
  title: { fontSize: 28, fontFamily: fonts.display, fontWeight: '600', color: c.burgundy[500] },
  card: { backgroundColor: c.white, borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: c.gray[200] },
  status: { fontSize: 14, fontWeight: '600', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  statusOk: { color: c.green[700], backgroundColor: c.green[50] },
  statusWarn: { color: c.amber[700], backgroundColor: c.amber[50] },
  statusMuted: { color: c.gray[600], backgroundColor: c.gray[100] },
  cardNote: { fontSize: 15, lineHeight: 22, color: c.gray[700] },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kvKey: { fontSize: 15, color: c.gray[500] },
  kvVal: { fontSize: 15, color: c.gray[800], fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  actions: { backgroundColor: c.white, borderRadius: 12, borderWidth: 1, borderColor: c.gray[200], overflow: 'hidden' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.gray[200] },
  actionText: { fontSize: 16, color: c.gray[800] },
  actionDanger: { color: c.red[700] },
  chevron: { fontSize: 20, color: c.gray[400] },
  primary: { backgroundColor: c.burgundy[500], borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: c.white, fontSize: 16, fontWeight: '600' },
  banner: { backgroundColor: c.amber[50], borderRadius: 10, padding: 14, borderWidth: 1, borderColor: c.amber[700] },
  bannerText: { fontSize: 15, lineHeight: 22, color: c.amber[700] },
  error: { fontSize: 14, color: c.red[700] },
  history: { gap: 8 },
  historyTitle: { fontSize: 14, fontWeight: '600', color: c.gray[500] },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  historyDate: { fontSize: 15, fontWeight: '600', color: c.gray[800] },
  historyVal: { fontSize: 15, color: c.gray[600] },
});
