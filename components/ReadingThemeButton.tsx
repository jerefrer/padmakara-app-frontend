import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { READING_THEMES, themeSurfaces, type ReadingTheme } from '@/utils/pdfReadingTheme';

const FALLBACK_LABELS: Record<ReadingTheme, string> = {
  normal: 'Normal',
  sepia: 'Sepia',
  night: 'Night (negative)',
};

interface ReadingThemeButtonProps {
  theme: ReadingTheme;
  onChange: (theme: ReadingTheme) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The phone reader's reading-theme control: a header button that opens a small
 * menu with the same three themes (and swatches) as the web viewer's toolbar.
 * Renders nothing on the web, where the viewer has its own toolbar.
 */
export function ReadingThemeButton({ theme, onChange, style, testID }: ReadingThemeButtonProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') return null;

  const label = t('pdfViewer.readingTheme') || 'Reading theme';
  return (
    <>
      <TouchableOpacity
        testID={testID}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="contrast-outline" size={22} color={colors.burgundy[500]} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t('common.close') || 'Close'}>
          <View style={[styles.menu, { marginTop: insets.top + 52 }]} accessibilityLabel={label}>
            {READING_THEMES.map((option) => {
              const active = option === theme;
              return (
                <TouchableOpacity
                  key={option}
                  testID={`reading-theme-${option}`}
                  style={styles.option}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.swatch, { backgroundColor: themeSurfaces(option).paper }, active && styles.swatchActive]} />
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {t(`pdfViewer.theme.${option}`) || FALLBACK_LABELS[option]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  menu: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 190,
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.gray[400],
    marginRight: 12,
  },
  swatchActive: {
    borderColor: colors.burgundy[500],
    borderWidth: 2,
  },
  optionText: {
    fontSize: 16,
    color: colors.gray[700],
  },
  optionTextActive: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },
});
