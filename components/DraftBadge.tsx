/**
 * DraftBadge - Indicator for draft events visible to admins only
 *
 * A pill-style badge showing an event is in draft state.
 * The backend only returns draft events to admin users, so no
 * role check is needed here.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

export function DraftBadge() {
  const { t } = useLanguage();
  return (
    <View style={styles.badge}>
      <Ionicons name="ellipse" size={8} color={colors.saffron[600]} />
      <Text style={styles.badgeText}>{t('common.draft') || 'Draft'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.saffron[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.saffron[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default DraftBadge;
