import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { membershipService, type MembershipView } from '@/services/membershipService';
import { formatLongDate } from '@/utils/dateFormat';
import { formatEuro } from '@/utils/membership';
import { ChangeAmountModal } from './ChangeAmountModal';
import { membershipErrorMessage } from './errorMessage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusRing } from './focusRing';
import { pageStyles } from './pageStyles';
import { membershipColors as c } from './theme';
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
  // `busy` alone is not a guard: two taps before React re-renders both see it false.
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const { state, source, amount, interval, accessUntil, graceUntil, method, history } = membership;
  const date = (iso: string | null) => (iso ? formatLongDate(iso, language) : '');
  const generic = tr(t, 'errGeneric', 'Something went wrong. Please try again.');

  const run = async (call: () => Promise<{ success: boolean; code?: string }>, after: () => void) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await call();
      if (res.success) after();
      else setError(membershipErrorMessage(t, res.code));
    } catch {
      setError(generic);
    } finally {
      inFlight.current = false;
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
        return { success: false, code: res.code };
      },
      () => {},
    );

  const contribution =
    amount === null
      ? null
      : interval === 'year'
        ? tr(t, 'rowYear', '{{amount}} a year', { amount: formatEuro(amount, lang) })
        : tr(t, 'rowMonth', '{{amount}} a month', { amount: formatEuro(amount, lang) });

  const paidWith = method
    ? method.type === 'direct_debit'
      ? tr(t, 'directDebit', 'Direct Debit')
      : [method.brand ?? 'Card', method.lastFour ? `\u2022\u2022\u2022\u2022 ${method.lastFour}` : null].filter(Boolean).join(' ')
    : null;

  const status =
    state === 'cancelled'
      ? {
          // Never "Ends " with nothing after it.
          label: accessUntil
            ? tr(t, 'statusEnds', 'Ends {{date}}', { date: date(accessUntil) })
            : tr(t, 'statusCancelled', 'Cancelled'),
          dot: c.gray[400],
          tone: styles.statusMuted,
        }
      : state === 'payment_failed'
        ? { label: tr(t, 'statusPaymentNeeded', 'Payment needed'), dot: c.amber[700], tone: styles.statusWarn }
        : { label: tr(t, 'statusActiveMember', 'Active member'), dot: c.green[700], tone: styles.statusOk };

  const managedByUs = source !== 'easypay';
  const canChange = !managedByUs && state !== 'cancelled';

  const primaryButton = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
      onPress={onPress}
      disabled={busy}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {tr(t, 'manageTitle', 'Membership')}
      </Text>

      <View style={styles.statusLine}>
        <Text style={[styles.statusDot, { color: status.dot }]}>{'\u25CF'}</Text>
        <Text style={[styles.status, status.tone]}>{status.label}</Text>
      </View>

      {state === 'payment_failed' && !managedByUs && (
        <Text style={styles.warning}>
          {graceUntil
            ? tr(
                t,
                'failedBanner',
                "Your last payment didn't go through. Your access continues until {{date}}. Update your payment method to keep it.",
                { date: date(graceUntil) },
              )
            : tr(
                t,
                'failedBannerNoDate',
                "Your last payment didn't go through. Update your payment method to keep your access.",
              )}
        </Text>
      )}
      {state === 'payment_failed' && !managedByUs && primaryButton(tr(t, 'updateMethod', 'Update payment method'), updateMethod)}

      {state === 'cancelled' && accessUntil && (
        <Text style={styles.note}>
          {tr(t, 'cancelledNote', 'Your access continues until then. No further payments will be taken.')}
        </Text>
      )}
      {managedByUs && <Text style={styles.note}>{tr(t, 'contactUs', 'Contact us to change your membership')}</Text>}

      <Text style={pageStyles.sectionLabel}>{tr(t, 'contributionLabel', 'Your contribution')}</Text>
      <View style={styles.rows}>
        {contribution && (
          <Row
            id="contribution"
            icon="heart-outline"
            label={tr(t, 'rowContribution', 'Contribution')}
            value={contribution}
            // The floor depends on the interval; without it the modal would guess "month".
            onPress={canChange && state === 'active' && interval !== null ? () => setChangingAmount(true) : undefined}
            disabled={busy}
          />
        )}
        {state !== 'cancelled' && date(accessUntil) !== '' && (
          <Row id="next-payment" icon="calendar-outline" label={tr(t, 'rowNextPayment', 'Next payment')} value={date(accessUntil)} />
        )}
        {paidWith && (
          <Row
            id="paid-with"
            icon="card-outline"
            label={tr(t, 'rowPaidWith', 'Paid with')}
            value={paidWith}
            onPress={canChange ? updateMethod : undefined}
            disabled={busy}
          />
        )}
      </View>

      {history.length > 0 && (
        <>
          <Text style={pageStyles.sectionLabel}>{tr(t, 'historyTitle', 'Payments')}</Text>
          <View style={styles.rows}>
            {history.map((h, i) => {
              const [key, fallback] = OUTCOME_LABEL[h.outcome];
              const outcome = tr(t, key, fallback);
              return (
                <View style={pageStyles.row} key={`${h.date}-${i}`}>
                  <Text style={styles.historyDate}>{date(h.date)}</Text>
                  <Text style={styles.historyVal}>
                    {h.amount === null ? outcome : `${formatEuro(h.amount, lang)} \u00B7 ${outcome}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Easypay keeps retrying a failed charge, so the member must be able to stop it here too. */}
      {canChange && (
        <View style={[styles.rows, styles.cancelBlock]}>
          <Row
            id="cancel"
            label={tr(t, 'cancelMembership', 'Cancel membership')}
            danger
            onPress={() => setConfirmingCancel(true)}
            disabled={busy}
          />
        </View>
      )}

      {!managedByUs &&
        state === 'cancelled' &&
        primaryButton(tr(t, 'resumeMembership', 'Resume membership'), () =>
          run(() => membershipService.resume(), onChanged),
        )}

      {error && <Text style={styles.error}>{error}</Text>}

      <ConfirmationModal
        visible={confirmingCancel}
        title={tr(t, 'cancelTitle', 'Cancel your membership?')}
        message={
          accessUntil
            ? tr(
                t,
                'cancelMessage',
                'You keep full access until {{date}}, the end of the period you already paid for. No further payments will be taken.',
                { date: date(accessUntil) },
              )
            : tr(
                t,
                'cancelMessageNoDate',
                'You keep full access until the end of the period you already paid for. No further payments will be taken.',
              )
        }
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

/** A settings-style hairline row: value on the right, chevron only when it opens something. */
function Row({
  id,
  icon,
  label,
  value,
  onPress,
  danger = false,
  disabled = false,
}: {
  id: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const ring = useFocusRing();
  const content = (
    <>
      <View style={pageStyles.rowLeft}>
        {icon && <Ionicons name={icon} size={20} color={c.burgundy[500]} />}
        <Text style={[pageStyles.rowTitle, !icon && styles.rowTitleBare, danger && styles.danger]}>{label}</Text>
      </View>
      <View style={pageStyles.rowRight}>
        {value !== undefined && <Text style={pageStyles.rowValue}>{value}</Text>}
        {onPress && <Ionicons testID={`membership-row-${id}-chevron`} name="chevron-forward" size={16} color={c.gray[400]} />}
      </View>
    </>
  );
  if (!onPress) {
    return (
      <View testID={`membership-row-${id}`} style={pageStyles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={`membership-row-${id}`}
      accessibilityRole="button"
      accessibilityLabel={value !== undefined ? `${label}, ${value}` : label}
      disabled={disabled}
      onPress={onPress}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={({ pressed }) => [pageStyles.row, pressed && pageStyles.rowPressed, ring.style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: pageStyles.container,
  title: pageStyles.title,
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusDot: { fontSize: 11 },
  status: { fontSize: 13, fontWeight: '600' },
  statusOk: { color: c.green[700] },
  statusWarn: { color: c.amber[700] },
  statusMuted: { color: c.gray[600] },
  warning: { fontSize: 15, lineHeight: 22, color: c.amber[700], marginTop: 16 },
  note: { fontSize: 15, lineHeight: 22, color: c.gray[700], marginTop: 16 },
  rows: { borderTopWidth: 1, borderTopColor: c.gray[200] },
  rowTitleBare: { marginLeft: 0 },
  danger: { color: c.burgundy[500] },
  cancelBlock: { marginTop: 32 },
  historyDate: { fontSize: 16, fontWeight: '500', color: c.gray[800] },
  historyVal: { fontSize: 14, color: c.gray[600] },
  primary: { ...pageStyles.button, marginTop: 16 },
  primaryPressed: pageStyles.buttonPressed,
  primaryText: pageStyles.buttonText,
  error: { fontSize: 14, color: c.red[700], marginTop: 16 },
});
