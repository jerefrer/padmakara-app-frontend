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

  return (
    <View>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {suggested.map((amount) => {
          const selected = !custom && value === amount;
          return (
            <Chip
              key={amount}
              selected={selected}
              label={formatEuro(amount, lang)}
              onPress={() => {
                setCustom(false);
                setText('');
                setTouched(false);
                onChange(amount);
              }}
            />
          );
        })}
        <Chip
          selected={custom}
          label={tr(t, 'other', 'Other')}
          onPress={() => {
            if (custom) return;
            openedByPerson.current = true;
            setCustom(true);
            const v = validateAmount(text, interval);
            onChange(v.ok ? v.amount : null);
          }}
        />
      </View>

      {custom && (
        <>
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
          <Text style={styles.unit}>
            {interval === 'month'
              ? tr(t, 'otherUnitMonth', 'per month · minimum {{min}}', { min })
              : tr(t, 'otherUnitYear', 'per year · minimum {{min}}', { min })}
          </Text>
        </>
      )}
      {message && <Text style={styles.error}>{message}</Text>}
    </View>
  );
}

function Chip({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  const ring = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipOn, ring.style]}
      onPress={onPress}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'flex-start',
    minWidth: 120,
    borderWidth: 1,
    borderColor: c.gray[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: c.white,
  },
  input: {
    flex: 1,
    minWidth: 60,
    paddingVertical: 8,
    fontSize: 18,
    color: c.gray[800],
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  euro: { fontSize: 18, color: c.gray[500], marginLeft: 8 },
  unit: { marginTop: 6, fontSize: 13, color: c.gray[500] },
  error: { marginTop: 8, fontSize: 14, color: c.red[700] },
});
