import React, { useRef } from 'react';
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
import { space } from './pageStyles';
import { tr } from './tr';
import { useFocusRing } from './focusRing';

/** What a person has chosen for one interval: a suggested amount or their own typed value. */
export interface AmountChoice {
  selected: number | 'other';
  custom: string;
  touched: boolean;
}

export const defaultChoice = (interval: MembershipInterval): AmountChoice => ({
  selected: SUGGESTED[interval][1],
  custom: '',
  touched: false,
});

/** A choice that shows an already known amount (a suggested row, or Another amount with that value). */
export const choiceFor = (interval: MembershipInterval, amount: number | null): AmountChoice =>
  amount === null
    ? defaultChoice(interval)
    : SUGGESTED[interval].includes(amount)
      ? { selected: amount, custom: '', touched: false }
      : { selected: 'other', custom: String(amount), touched: false };

/** The amount a choice stands for, or null while Another amount is empty or invalid. */
export function choiceAmount(choice: AmountChoice, interval: MembershipInterval): number | null {
  if (choice.selected !== 'other') return choice.selected;
  const v = validateAmount(choice.custom, interval);
  return v.ok ? v.amount : null;
}

interface Props {
  interval: MembershipInterval;
  choice: AmountChoice;
  onChoice: (choice: AmountChoice) => void;
}

export function AmountPicker({ interval, choice, onChoice }: Props) {
  const { t, language } = useLanguage();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';
  const suggested = SUGGESTED[interval];
  const custom = choice.selected === 'other';
  const text = choice.custom;
  const touched = choice.touched;
  // Focus the field only when the person opened it, not when it is restored from memory.
  const openedByPerson = useRef(false);

  const min = formatEuro(MIN_AMOUNT[interval], lang);
  const max = formatEuro(MAX_AMOUNT, lang);

  const validation = custom ? validateAmount(text, interval) : null;
  const message = (() => {
    // An empty field is not a mistake (the person may just have clicked elsewhere): the
    // grey helper and the disabled button already say what is missing. Red is only for a
    // typed value that is invalid.
    if (!touched || !validation || validation.ok || text.trim() === '') return null;
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

  const onText = (next: string) => onChoice({ ...choice, custom: next, touched: true });

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
            selected={choice.selected === amount}
            label={rowLabel(amount)}
            onPress={() => {
              onChoice({ ...choice, selected: amount });
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
            onChoice({ ...choice, selected: 'other' });
          }}
        >
          {custom && (
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={onText}
                onBlur={() => onChoice({ ...choice, touched: true })}
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
        <Text testID="amount-helper" style={styles.unit}>
          {interval === 'month'
            ? tr(t, 'otherUnitMonth', 'per month · minimum {{min}}', { min })
            : tr(t, 'otherUnitYear', 'per year · minimum {{min}}', { min })}
        </Text>
      )}
      {message && <Text testID="amount-helper" style={styles.error}>{message}</Text>}
    </View>
  );
}

/** A hairline radio row, like the rows in Settings. The label is the radio; any children follow it on the same line. */
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
    flexWrap: 'wrap',
    columnGap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.gray[200],
  },
  rowPress: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4 },
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
    columnGap: 6,
  },
  input: {
    // Wide enough for "1000.00", narrow enough that the € reads as part of the number.
    width: 72,
    paddingVertical: 4,
    paddingHorizontal: 2,
    fontSize: 16,
    textAlign: 'left',
    color: c.gray[800],
    borderBottomWidth: 1,
    borderBottomColor: c.gray[400],
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  euro: { fontSize: 16, color: c.gray[500] },
  unit: { marginTop: space.tight, fontSize: 13, color: c.gray[500] },
  error: { marginTop: space.tight, fontSize: 14, color: c.red[700] },
});
