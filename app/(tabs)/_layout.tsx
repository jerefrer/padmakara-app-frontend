import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/HapticTab';
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
          headerShown: false, // Let nested stacks handle headers
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
        }}
      >
        <Tabs.Screen
          name="(groups)"
          options={{
            title: t('navigation.retreats') || 'Retreats',
            tabBarIcon: ({ color }) => <Ionicons size={24} name="list" color={color} />,
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
    </AuthGuard>
  );
}
