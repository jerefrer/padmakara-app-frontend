import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { sortLanguageCodes } from '@/utils/contentLanguage';

/**
 * Names for language codes when the locale files have no entry. The `t()`
 * lookup at `content.language.<code>` is preferred; this keeps an unexpected
 * code readable rather than rendering an empty row.
 */
const LANGUAGE_NAME_FALLBACK: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  tib: 'Tibetan',
  fr: 'French',
  es: 'Spanish',
};

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** The display name for a single language code. */
export function getLanguageName(code: string, t: Translate): string {
  return (
    t(`content.language.${code}`) ||
    LANGUAGE_NAME_FALLBACK[code] ||
    code.toUpperCase()
  );
}

/**
 * The label summarising a selection, e.g. "All languages" or
 * "Tibetan + English". Everything selected reads as "All languages" — that is
 * what "all" means now that the preference is a set rather than a sentinel.
 */
export function getLanguageSelectionLabel(
  selected: string[],
  options: string[],
  t: Translate,
): string {
  const chosen = sortLanguageCodes(selected).filter((code) => options.includes(code));
  if (chosen.length === 0 || chosen.length === options.length) {
    return t('content.allLanguages') || 'All languages';
  }
  return chosen.map((code) => getLanguageName(code, t)).join(' + ');
}

interface LanguageCheckboxListProps {
  /** The language codes to offer, in display order. */
  options: string[];
  /** The currently selected codes. */
  selected: string[];
  /**
   * Called with the next selection. Never called with an empty selection —
   * the last remaining checkbox is disabled, so the user cannot filter the
   * list down to nothing.
   */
  onChange: (next: string[]) => void;
  t: Translate;
}

/**
 * The content-language picker, shared by Settings and the per-event picker
 * (which renders it in both a desktop dropdown and a mobile popup).
 *
 * Toggles apply immediately — there is no confirm step — so the track list
 * re-filters live behind the sheet.
 */
export function LanguageCheckboxList({
  options,
  selected,
  onChange,
  t,
}: LanguageCheckboxListProps) {
  const isLastSelected = (code: string) => selected.length === 1 && selected[0] === code;

  const toggle = (code: string) => {
    if (isLastSelected(code)) return;
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange(sortLanguageCodes(next));
  };

  return (
    <View>
      {options.map((code) => {
        const checked = selected.includes(code);
        const locked = isLastSelected(code);
        return (
          <TouchableOpacity
            key={code}
            style={[styles.item, checked && styles.itemChecked]}
            onPress={() => toggle(code)}
            disabled={locked}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: locked }}
            accessibilityLabel={getLanguageName(code, t)}
          >
            <Text
              style={[
                styles.itemText,
                checked && styles.itemTextChecked,
                locked && styles.itemTextLocked,
              ]}
            >
              {getLanguageName(code, t)}
            </Text>
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={20}
              color={
                locked
                  ? colors.gray[400]
                  : checked
                    ? colors.burgundy[500]
                    : colors.gray[400]
              }
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
    gap: 16,
  },
  itemChecked: {
    backgroundColor: colors.burgundy[50],
  },
  itemText: {
    fontSize: 14,
    color: colors.gray[700],
  },
  itemTextChecked: {
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  itemTextLocked: {
    opacity: 0.7,
  },
});
