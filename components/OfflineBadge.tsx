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
    50: '#f8f1f1',
    500: '#9b1b1b',
    600: '#7b1616',
  },
};

export function OfflineBadge() {
  const { t } = useLanguage();
  return (
    <View style={styles.badge}>
      <Ionicons name="checkmark-circle" size={12} color="#6b7280" />
      <Text style={styles.badgeText}>{t('retreats.offline') || 'Offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    gap: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default OfflineBadge;
