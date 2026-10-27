import React from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/ui/BackButton';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';
import { SectionBody } from '@/components/settings/SectionBody';
import { visibleSections } from '@/components/settings/sections';
import { SectionTitle } from '@/components/settings/ui';
import { useLanguage } from '@/contexts/LanguageContext';

/** One settings section on its own page (phone and narrow windows). */
export default function SettingsSectionScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isAuthenticated, isInitialized } = useAuth();
  const { section } = useLocalSearchParams<{ section: string }>();

  const def = visibleSections({ isWeb: Platform.OS === 'web', isAuthenticated }).find((s) => s.id === section);
  // Only the very first auth check blanks the page; signing out must not.
  if (!isInitialized) return null;
  // Unknown, hidden here (membership in the native app), or gone after signing out.
  if (!def) return <Redirect href={'/(tabs)/settings' as any} />;
  // The membership keeps its own page, which already has a back control and a title.
  if (def.id === 'membership') return <Redirect href={'/membership' as any} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.cream[100] }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 100 }}>
      <BackButton label={t('navigation.settings') || 'Settings'} fallback="/(tabs)/settings" />
      <View style={pageStyles.container}>
        <View style={{ marginTop: 8 }}>
          <SectionTitle>{t(def.labelKey) || def.fallback}</SectionTitle>
        </View>
        <SectionBody id={def.id} />
      </View>
    </ScrollView>
  );
}
