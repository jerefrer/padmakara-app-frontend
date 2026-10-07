import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
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

  const min = formatEuro(MIN_AMOUNT[interval], lang);
  const max = formatEuro(MAX_AMOUNT, lang);

  const validation = custom ? validateAmount(text, interval) : null;
  const message = (() => {
    if (!validation || validation.ok) return null;
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
    const v = validateAmount(next, interval);
    onChange(v.ok ? v.amount : null);
  };

  return (
    <View>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {suggested.map((amount) => {
          const selected = !custom && value === amount;
          return (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => {
                setCustom(false);
                onChange(amount);
              }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{formatEuro(amount, lang)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: custom }}
          style={[styles.chip, custom && styles.chipOn]}
          onPress={() => {
            setCustom(true);
            const v = validateAmount(text, interval);
            onChange(v.ok ? v.amount : null);
          }}
        >
          <Text style={[styles.chipText, custom && styles.chipTextOn]}>{tr(t, 'other', 'Other')}</Text>
        </Pressable>
      </View>

      {custom && (
        <View style={styles.customRow}>
          <Text style={styles.euro}>€</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={onText}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={String(MIN_AMOUNT[interval])}
            accessibilityLabel={tr(t, 'amountLabel', 'Amount')}
          />
          <Text style={styles.unit}>
            {interval === 'month'
              ? tr(t, 'otherUnitMonth', 'per month · minimum {{min}}', { min })
              : tr(t, 'otherUnitYear', 'per year · minimum {{min}}', { min })}
          </Text>
        </View>
      )}
      {message && <Text style={styles.error}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.gray[300],
    backgroundColor: c.white,
  },
  chipOn: { borderColor: c.burgundy[500], backgroundColor: c.burgundy[50] },
  chipText: { fontSize: 16, color: c.gray[700] },
  chipTextOn: { color: c.burgundy[500], fontWeight: '600' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  euro: { fontSize: 18, color: c.gray[700] },
  input: {
    minWidth: 80,
    borderWidth: 1,
    borderColor: c.gray[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 18,
    color: c.gray[800],
    backgroundColor: c.white,
  },
  unit: { fontSize: 14, color: c.gray[500] },
  error: { marginTop: 8, fontSize: 14, color: c.red[700] },
});
