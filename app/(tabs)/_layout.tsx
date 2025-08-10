import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useLanguage } from '@/contexts/LanguageContext';
import { AuthGuard } from '@/components/AuthGuard';

export default function TabLayout() {
  const { t } = useLanguage();
  return (
    <AuthGuard>
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#b91c1c', // Burgundy red
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: '#f8f8f8',
          },
          default: {
            backgroundColor: '#f8f8f8',
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Retreats',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="leaf.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('navigation.profile'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle.badge.checkmark" color={color} />,
        }}
      />
      <Tabs.Screen
        name="retreats"
        options={{
          href: null, // Hide this tab but keep the screen for navigation
        }}
      />
      <Tabs.Screen
        name="downloads"
        options={{
          href: null, // Hide this tab but keep the screen for navigation
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null, // Hide this tab but keep the screen for navigation
        }}
      />
    </Tabs>
    </AuthGuard>
  );
}
