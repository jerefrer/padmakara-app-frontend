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
import { SidebarNavigationProvider } from '@/contexts/SidebarNavigationContext';

export default function TabLayout() {
  const { t } = useLanguage();
  const { isMobile } = useDesktopLayout();

  const tabsElement = (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#b91c1c', // Burgundy red
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false, // Let nested stacks handle headers
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: isMobile
          ? Platform.select({
              ios: {
                position: 'absolute' as const,
                backgroundColor: '#f8f8f8',
              },
              default: {
                backgroundColor: '#f8f8f8',
              },
            })
          : { display: 'none' as const },
      }}
    >
      <Tabs.Screen
        name="(events)"
        options={{
          title: t('navigation.events') || 'Events',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="calendar-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="(groups)"
        options={{
          title: t('navigation.retreats') || 'Retreats',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="list" color={color} />,
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
        name="subscription"
        options={{
          title: t('navigation.subscription') || 'Subscribe',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="card-outline" color={color} />,
          // Hide on mobile — Apple Reader App rules: no subscription language
          ...(Platform.OS !== 'web' ? { href: null } : {}),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('navigation.settings') || 'Settings',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="settings" color={color} />,
        }}
      />
    </Tabs>
  );

  if (isMobile) {
    return tabsElement;
  }

  return (
    <SidebarNavigationProvider>
      <DesktopShell sidebar={<Sidebar />} playerBar={<DesktopPlayerBar />}>
        {tabsElement}
      </DesktopShell>
    </SidebarNavigationProvider>
  );
}
