import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
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
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
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
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    letterSpacing: 0.5,
  },
  spacer: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
  },
});