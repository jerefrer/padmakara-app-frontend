/**
 * ForthcomingBadge - Indicator for events announced but not yet available
 *
 * A pill-style badge, shaped like DraftBadge but in a calm neutral tone: the
 * event is visible to everyone who has access to it, its content is not open yet.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

export function ForthcomingBadge() {
  const { t } = useLanguage();
  return (
    <View style={styles.badge} testID="forthcoming-badge">
      <Ionicons name="time-outline" size={10} color={colors.gray[600]} />
      <Text style={styles.badgeText}>{t('common.forthcoming') || 'Forthcoming'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default ForthcomingBadge;
