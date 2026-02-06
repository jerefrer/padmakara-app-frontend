/**
 * OfflineBadge - Unified indicator for offline-available content
 *
 * A pill-style badge showing content is available offline.
 * Used consistently across retreat list and detail screens.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';

const colors = {
  burgundy: {
    50: '#fef2f2',
    500: '#b91c1c',
    600: '#991b1b',
  },
};

export function OfflineBadge() {
  const { t } = useLanguage();
  return (
    <View style={styles.badge}>
      <Ionicons name="checkmark-circle" size={12} color={colors.burgundy[600]} />
      <Text style={styles.badgeText}>{t('retreats.offline') || 'Offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.burgundy[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.burgundy[600],
  },
});

export default OfflineBadge;
