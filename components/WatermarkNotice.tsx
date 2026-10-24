import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';

interface WatermarkNoticeProps {
  /** Float over the screen (non-blocking) instead of sitting in the layout. */
  floating?: boolean;
}

/**
 * Tells the reader why opening a gated PDF takes a moment: the server is
 * stamping a personal copy with their name and email.
 */
export function WatermarkNotice({ floating = false }: WatermarkNoticeProps) {
  const { t } = useLanguage();
  const message =
    t('documents.watermarkNotice') ||
    'Your personal copy is being generated and watermarked with your name and email.';

  if (floating) {
    return (
      <View style={styles.floating} pointerEvents="none" testID="watermark-notice" accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.burgundy[500]} />
        <Text style={styles.floatingText}>{message}</Text>
      </View>
    );
  }

  return (
    <Text style={styles.inline} testID="watermark-notice" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  inline: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
  floating: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.burgundy[50],
    borderWidth: 1,
    borderColor: colors.burgundy[100],
    alignSelf: 'center',
    maxWidth: 480,
  },
  floatingText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray[700],
  },
});
