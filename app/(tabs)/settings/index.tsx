import React from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { membershipColors as c } from '@/components/membership/theme';
import { defaultSection } from '@/components/settings/sections';
import { SettingsList, SettingsTwoPane } from '@/components/settings/SettingsLayouts';

// Below this window width the content column is too narrow for an index beside a pane.
const TWO_PANE_MIN_WIDTH = 1200;

/**
 * Settings, sorted by where each setting lives: "Your account" follows the person everywhere,
 * "This device" only applies here. Wide desktop shows the index and one section side by side
 * (?section= picks it); everywhere else the index is a list of pages.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDesktopLayout();
  const { width } = useWindowDimensions();
  const { isAuthenticated } = useAuth();
  const { section } = useLocalSearchParams<{ section?: string }>();

  const twoPane = isDesktop && width >= TWO_PANE_MIN_WIDTH;
  const selected = defaultSection({ isWeb: Platform.OS === 'web', isAuthenticated }, section);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: c.cream[100] }}>
      {twoPane ? (
        <SettingsTwoPane selected={selected} onSelect={(id) => router.setParams({ section: id })} />
      ) : (
        <SettingsList />
      )}
    </View>
  );
}
