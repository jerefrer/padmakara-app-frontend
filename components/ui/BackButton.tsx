import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';

/**
 * The one back control of the app: a chevron, plus the name of the screen you return to.
 *
 * - "default": a full row above the page content (settings pages, membership), chevron and label.
 * - "inline": sits next to a title in a header; icon only unless a `label` is given.
 * - "overlay": a white chevron in a translucent circle, floating over a hero image. Position it
 *   with `style` (absolute, top/left).
 */
interface Props {
  /** Name of the screen you return to; defaults to "Back". Inline and overlay show it only to screen readers. */
  label?: string;
  /** Where to go when there is no history to go back to (a reload). */
  fallback?: string;
  /** Wider row, for the two-column pay screen. */
  wide?: boolean;
  variant?: 'default' | 'inline' | 'overlay';
  /** Replaces the default "go back, or open `fallback`". */
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function BackButton({
  label,
  fallback = '/(tabs)',
  wide = false,
  variant = 'default',
  onPress,
  disabled = false,
  style,
  testID,
}: Props = {}) {
  const { t } = useLanguage();
  const text = label ?? (t('navigation.back') || 'Back');
  const goBack =
    onPress ??
    (() => {
      if (router.canGoBack()) router.back();
      else router.replace(fallback as any);
    });

  if (variant === 'overlay') {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={text}
        onPress={goBack}
        disabled={disabled}
        hitSlop={8}
        style={[styles.overlay, style]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.white} />
      </Pressable>
    );
  }

  const showLabel = variant === 'default' || label !== undefined;
  const button = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={goBack}
      disabled={disabled}
      style={[styles.button, !showLabel && styles.iconOnly, variant === 'inline' && styles.inline, style]}
    >
      <Ionicons name="chevron-back" size={22} color={colors.burgundy[500]} />
      {showLabel ? <Text style={styles.text}>{text}</Text> : null}
    </Pressable>
  );
  if (variant === 'inline') return button;
  return <View style={[styles.row, wide && styles.rowWide]}>{button}</View>;
}

const styles = StyleSheet.create({
  row: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20 },
  rowWide: { maxWidth: 960 },
  button: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  iconOnly: { minWidth: 44, justifyContent: 'center' },
  // Pulls the chevron's own padding into the page margin so it lines up with the title below.
  inline: { alignSelf: 'center', marginLeft: -10 },
  text: { fontSize: 16, fontWeight: '500', color: colors.burgundy[500] },
  overlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
