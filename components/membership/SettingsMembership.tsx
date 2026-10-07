import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipColors as c } from './theme';
import { tr } from './tr';
import { membershipStatusLine } from './statusLine';

/**
 * Web Settings: the one membership entry. A "MEMBERSHIP" section holding a single settings row
 * (ribbon icon, label, status, chevron) that opens /membership. Native never renders this
 * (reader-app rule: no price, no link).
 */
export function SettingsMembership() {
  const { t, language } = useLanguage();
  const { hasActiveSubscription, user } = useAuth();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';

  return (
    <>
      <Text style={styles.sectionLabel}>{tr(t, 'manageTitle', 'Membership')}</Text>
      <View style={styles.section}>
        <Pressable
          testID="settings-membership-row"
          accessibilityRole="button"
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          onPress={() => router.push('/membership' as any)}
        >
          <View style={styles.left}>
            <Ionicons name="ribbon-outline" size={20} color={c.burgundy[500]} />
            <Text style={styles.title}>
              {hasActiveSubscription ? tr(t, 'settingsRow', 'Membership') : tr(t, 'title', 'Become a member')}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.value}>
              {membershipStatusLine(t, lang, hasActiveSubscription, user?.subscription)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.gray[400]} />
          </View>
        </Pressable>
      </View>
    </>
  );
}

// Same values as sectionTitleOutside, section, settingItem and friends in app/(tabs)/settings.tsx.
const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 32,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  section: { marginHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.gray[200] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.gray[200],
  },
  pressed: { backgroundColor: c.gray[100], opacity: 0.8 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { fontSize: 16, fontWeight: '500', color: c.gray[800], marginLeft: 12 },
  right: { flexDirection: 'row', alignItems: 'center' },
  value: { fontSize: 14, color: c.gray[600], marginRight: 8 },
});
