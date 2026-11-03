import { Tabs, useSegments } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DesktopPlayerBar } from '@/components/desktop/DesktopPlayerBar';
import { MiniPlayer, usePlayerBarAboveTabBar } from '@/components/MiniPlayer';
import { BAR_TOP_SHADOW } from '@/constants/barShadow';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { Sidebar } from '@/components/desktop/Sidebar';
import { RightSidebar } from '@/components/desktop/RightSidebar';
import { SidebarNavigationProvider } from '@/contexts/SidebarNavigationContext';

export const unstable_settings = {
  initialRouteName: '(groups)',
};

// Under a player bar the tab bar is the lower half of one block: a hairline
// instead of its own shadow (the player bar carries the stack's shadow).
const BAR_JOIN = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' };

export default function TabLayout() {
  const { t } = useLanguage();
  const { isMobile } = useDesktopLayout();
  const segments = useSegments() as string[];
  const tabBarHeight = useTabBarHeight();
  const bottomInset = useSafeAreaInsets().bottom;
  // elevation 0: drop react-navigation's default Android shadow, the boxShadow replaces it.
  const barTop: ViewStyle = { ...(usePlayerBarAboveTabBar() ? BAR_JOIN : BAR_TOP_SHADOW), elevation: 0 };
  // The right rail collapses to a 64px strip on focused content screens
  // (event detail, transcript reader). Everywhere else it's the wide
  // brand panel.
  const isOnFocusedContent =
    segments.includes('(groups)') &&
    (segments.includes('retreat') || segments.includes('transcript'));
  const rightVariant = isOnFocusedContent ? 'narrow' : 'wide';
  const rightWidth = isOnFocusedContent ? 64 : 220;

  const tabsElement = (
    <Tabs
      initialRouteName="(groups)"
      screenOptions={{
        tabBarActiveTintColor: '#9b1b1b',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: isMobile
          ? Platform.select({
              ios: {
                position: 'absolute' as const,
                backgroundColor: '#ffffff',
                ...barTop,
              },
              // Explicit height and padding: under Android edge-to-edge the
              // bar must extend below the system navigation bar (white all
              // the way down), and MiniPlayer / AudioPlayer position
              // themselves from the same useTabBarHeight() value.
              default: {
                backgroundColor: '#ffffff',
                height: tabBarHeight,
                paddingBottom: bottomInset,
                ...barTop,
              },
            })
          : { display: 'none' as const },
      }}
    >
      <Tabs.Screen
        name="(groups)"
        options={{
          title: t('navigation.home') || 'Home',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('navigation.search') || 'Search',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: t('navigation.bookmarks') || 'Bookmarks',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="bookmark-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('navigation.account') || 'Account',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="person-circle-outline" color={color} />,
        }}
      />
      {/* Hidden tabs - accessible via navigation but not shown in tab bar */}
      <Tabs.Screen
        name="_events"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="membership"
        options={{
          href: null,
          popToTopOnBlur: true,
        }}
      />
      {/* /get/:id: public page to get a teaching's recordings (web only), hidden like membership. */}
      <Tabs.Screen
        name="get"
        options={{
          href: null,
          popToTopOnBlur: true,
        }}
      />
      {/* /account: stable address, hidden like membership. See account.tsx before changing it. */}
      <Tabs.Screen
        name="account"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );

  if (Platform.OS !== 'web') {
    // Native keeps one tree for every width (Split View resize, rotation):
    // the shell hides the slots it doesn't need, so the navigator below
    // never remounts and keeps its navigation state.
    return (
      <SidebarNavigationProvider>
        <DesktopShell
          sidebar={<Sidebar />}
          rightSidebar={<RightSidebar variant={rightVariant} />}
          rightSidebarWidth={rightWidth}
          playerBar={<DesktopPlayerBar />}
        >
          <View style={{ flex: 1 }}>
            {tabsElement}
            {isMobile ? <MiniPlayer /> : null}
          </View>
        </DesktopShell>
      </SidebarNavigationProvider>
    );
  }

  if (isMobile) {
    return (
      <View style={{ flex: 1 }}>
        {tabsElement}
        <MiniPlayer />
      </View>
    );
  }

  return (
    <SidebarNavigationProvider>
      <DesktopShell
        sidebar={<Sidebar />}
        rightSidebar={<RightSidebar variant={rightVariant} />}
        rightSidebarWidth={rightWidth}
        playerBar={<DesktopPlayerBar />}
      >
        {tabsElement}
      </DesktopShell>
    </SidebarNavigationProvider>
  );
}
