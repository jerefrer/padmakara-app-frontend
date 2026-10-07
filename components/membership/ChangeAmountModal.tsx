import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipService } from '@/services/membershipService';
import { MAX_AMOUNT, MIN_AMOUNT, formatEuro, type MembershipInterval } from '@/utils/membership';
import { AmountPicker } from './AmountPicker';
import { membershipErrorMessage } from './errorMessage';
import { membershipColors as c, fonts } from './theme';
import { tr } from './tr';

interface Props {
  visible: boolean;
  interval: MembershipInterval;
  currentAmount: number | null;
  /** Already formatted date of the next payment. */
  nextPaymentDate: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ChangeAmountModal({ visible, ...rest }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={rest.onClose}>
      {/* The body mounts only while open, so its draft amount resets on every opening. */}
      <Body {...rest} />
    </Modal>
  );
}

function Body({ interval, currentAmount, nextPaymentDate, onClose, onSaved }: Omit<Props, 'visible'>) {
  const { t, language } = useLanguage();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';
  const [amount, setAmount] = useState<number | null>(currentAmount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (amount === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await membershipService.changeAmount(amount);
      if (res.success) {
        onSaved();
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

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <Text style={styles.title} accessibilityRole="header">
          {tr(t, 'changeAmountTitle', 'Change amount')}
        </Text>
        {/* AmountPicker reads `value` only on mount; key by interval so it remounts if that ever changes. */}
        <AmountPicker key={interval} interval={interval} value={amount} onChange={setAmount} />
        {nextPaymentDate && (
          <Text style={styles.note}>
            {tr(t, 'changeAmountNote', 'Your new contribution applies from your next payment on {{date}}.', {
              date: nextPaymentDate,
            })}
          </Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: amount === null || busy }}
          disabled={amount === null || busy}
          style={[styles.primary, (amount === null || busy) && styles.primaryOff]}
          onPress={save}
        >
          <Text style={styles.primaryText}>{tr(t, 'save', 'Save')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={onClose}>
          <Text style={styles.secondaryText}>{tr(t, 'close', 'Close')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: c.white, borderRadius: 12, padding: 24, gap: 16 },
  title: { fontSize: 22, fontFamily: fonts.display, fontWeight: '600', color: c.gray[800] },
  note: { fontSize: 14, lineHeight: 20, color: c.gray[600] },
  error: { fontSize: 14, color: c.red[700] },
  primary: { backgroundColor: c.burgundy[500], borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  primaryOff: { backgroundColor: c.gray[300] },
  primaryText: { color: c.white, fontSize: 16, fontWeight: '600' },
  secondary: { paddingVertical: 8, alignItems: 'center' },
  secondaryText: { color: c.burgundy[500], fontSize: 16 },
});
