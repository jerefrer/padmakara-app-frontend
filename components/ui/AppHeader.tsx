import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';

const colors = {
  cream: {
    100: '#fefefe',
  },
  burgundy: {
    500: '#9b1b1b',
    600: '#7b1616',
  },
  gray: {
    200: '#e5e7eb',
    300: '#d1d5db',
  },
};

interface AppHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  title?: string; // Optional custom title instead of "Padmakara"
}

export function AppHeader({ showBackButton = false, onBackPress, title }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { showSidebar } = useDesktopLayout();

  // Sidebar handles navigation on desktop — hide the header
  if (showSidebar) {
    return null;
  }
  
  const handleLogoPress = () => {
    // Navigate to home when logo is tapped (unless we're already on home)
    router.push('/');
  };
  
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {showBackButton && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBackPress}
            accessibilityLabel="Go back"
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.logoContainer}
          onPress={handleLogoPress}
          accessibilityLabel="Go to home"
        >
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.appName}>
            {title || 'Padmakara'}
          </Text>
        </TouchableOpacity>
        
        {/* Spacer to center the logo when there's a back button */}
        {showBackButton && <View style={styles.spacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cream[100],
    borderBottomWidth: 2,
    borderBottomColor: colors.burgundy[500],
  },
  content: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  backIcon: {
    fontSize: 24,
    color: colors.burgundy[500],
    fontWeight: 'bold',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  appName: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.burgundy[500],
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  spacer: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
  },
});