import React, { useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  MIN_AMOUNT,
  MAX_AMOUNT,
  SUGGESTED,
  formatEuro,
  validateAmount,
  type MembershipInterval,
} from '@/utils/membership';
import { membershipColors as c } from './theme';
import { tr } from './tr';
import { useFocusRing } from './focusRing';

interface Props {
  interval: MembershipInterval;
  value: number | null;
  onChange: (amount: number | null) => void;
}

export function AmountPicker({ interval, value, onChange }: Props) {
  const { t, language } = useLanguage();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';
  const suggested = SUGGESTED[interval];
  const startsCustom = value !== null && !suggested.includes(value);
  const [custom, setCustom] = useState(startsCustom);
  const [text, setText] = useState(startsCustom ? String(value) : '');
  const [touched, setTouched] = useState(false);
  // Focus the field only when the person opened it, not when it is restored from a saved value.
  const openedByPerson = useRef(false);

  const min = formatEuro(MIN_AMOUNT[interval], lang);
  const max = formatEuro(MAX_AMOUNT, lang);

  const validation = custom ? validateAmount(text, interval) : null;
  const message = (() => {
    if (!touched || !validation || validation.ok) return null;
    switch (validation.reason) {
      case 'min':
        return tr(t, 'errMin', 'Please enter at least {{min}}.', { min });
      case 'max':
        return tr(t, 'errMax', 'Please enter at most {{max}}.', { max });
      case 'decimals':
        return tr(t, 'errDecimals', 'Use at most two decimals.');
      default:
        return tr(t, 'errNan', 'Enter an amount.');
    }
  })();

  const onText = (next: string) => {
    setText(next);
    setTouched(true);
    const v = validateAmount(next, interval);
    onChange(v.ok ? v.amount : null);
  };

  const rowLabel = (amount: number) =>
    interval === 'month'
      ? tr(t, 'rowMonth', '{{amount}} a month', { amount: formatEuro(amount, lang) })
      : tr(t, 'rowYear', '{{amount}} a year', { amount: formatEuro(amount, lang) });

  return (
    <View>
      <View style={styles.rows} accessibilityRole="radiogroup">
        {suggested.map((amount) => (
          <AmountRow
            key={amount}
            testID={`amount-row-${amount}`}
            selected={!custom && value === amount}
            label={rowLabel(amount)}
            onPress={() => {
              setCustom(false);
              setText('');
              setTouched(false);
              onChange(amount);
            }}
          />
        ))}
        <AmountRow
          testID="amount-row-other"
          selected={custom}
          label={tr(t, 'otherRow', 'Another amount')}
          onPress={() => {
            if (custom) return;
            openedByPerson.current = true;
            setCustom(true);
            const v = validateAmount(text, interval);
            onChange(v.ok ? v.amount : null);
          }}
        >
          {custom && (
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={onText}
                onBlur={() => setTouched(true)}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder={String(MIN_AMOUNT[interval])}
                placeholderTextColor={c.gray[400]}
                autoFocus={Platform.OS === 'web' && openedByPerson.current}
                accessibilityLabel={tr(t, 'amountLabel', 'Amount')}
              />
              <Text style={styles.euro}>€</Text>
            </View>
          )}
        </AmountRow>
      </View>

      {custom && (
        <Text style={styles.unit}>
          {interval === 'month'
            ? tr(t, 'otherUnitMonth', 'per month · minimum {{min}}', { min })
            : tr(t, 'otherUnitYear', 'per year · minimum {{min}}', { min })}
        </Text>
      )}
      {message && <Text style={styles.error}>{message}</Text>}
    </View>
  );
}

/** A hairline radio row, like the rows in Settings. The label is the radio; any children sit on the right. */
function AmountRow({
  selected,
  label,
  onPress,
  testID,
  children,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  testID: string;
  children?: React.ReactNode;
}) {
  const ring = useFocusRing();
  return (
    <View style={styles.row}>
      <Pressable
        testID={testID}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        style={[styles.rowPress, ring.style]}
        onPress={onPress}
        onFocus={ring.onFocus}
        onBlur={ring.onBlur}
      >
        <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
        <Text style={[styles.rowText, selected && styles.rowTextOn]}>{label}</Text>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { borderTopWidth: 1, borderTopColor: c.gray[200] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.gray[200],
  },
  rowPress: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: c.gray[400],
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: c.burgundy[500] },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.burgundy[500] },
  rowText: { fontSize: 16, color: c.gray[800] },
  rowTextOn: { fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 90,
    marginRight: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.gray[400],
  },
  input: {
    flex: 1,
    minWidth: 60,
    paddingVertical: 4,
    paddingHorizontal: 2,
    fontSize: 16,
    textAlign: 'right',
    color: c.gray[800],
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  euro: { fontSize: 16, color: c.gray[500], marginLeft: 6 },
  unit: { marginTop: 8, fontSize: 13, color: c.gray[500] },
  error: { marginTop: 8, fontSize: 14, color: c.red[700] },
});
