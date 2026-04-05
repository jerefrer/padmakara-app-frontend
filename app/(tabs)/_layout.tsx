import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { DesktopPlayerBar } from '@/components/desktop/DesktopPlayerBar';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { Sidebar } from '@/components/desktop/Sidebar';
import { RightSidebar } from '@/components/desktop/RightSidebar';
import { SidebarNavigationProvider } from '@/contexts/SidebarNavigationContext';

export const unstable_settings = {
  initialRouteName: '(groups)',
};

export default function TabLayout() {
  const { t } = useLanguage();
  const { isMobile } = useDesktopLayout();

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
              },
              default: {
                backgroundColor: '#ffffff',
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
        name="subscription"
        options={{
          href: null,
          title: t('navigation.subscription') || 'Subscribe',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="card-outline" color={color} />,
        }}
      />
    </Tabs>
  );

  if (isMobile) {
    return tabsElement;
  }

  return (
    <SidebarNavigationProvider>
      <DesktopShell sidebar={<Sidebar />} rightSidebar={<RightSidebar />} playerBar={<DesktopPlayerBar />}>
        {tabsElement}
      </DesktopShell>
    </SidebarNavigationProvider>
  );
}
