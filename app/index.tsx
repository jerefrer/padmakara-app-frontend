import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    500: '#b91c1c',
  },
};

export default function RootIndex() {
  const { isAuthenticated, isLoading, isDeviceActivated } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [redirectTimeout, setRedirectTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing redirect timeout
    if (redirectTimeout) {
      clearTimeout(redirectTimeout);
      setRedirectTimeout(null);
    }

    // Don't redirect while loading or if already redirected
    if (isLoading || hasRedirected) {
      return;
    }

    console.log(`🚀 RootIndex routing evaluation:`, {
      authenticated: isAuthenticated,
      deviceActivated: isDeviceActivated, 
      loading: isLoading,
      hasRedirected
    });

    // Add a small delay to ensure state updates have settled
    const timeout = setTimeout(() => {
      if (!hasRedirected) {
        setHasRedirected(true);
        
        if (isAuthenticated && isDeviceActivated) {
          console.log('✅ User authenticated and device activated, redirecting to main app');
          router.replace('/(tabs)');
        } else {
          console.log('❌ User not authenticated or device not activated, redirecting to magic link');
          router.replace('/(auth)/magic-link');
        }
      }
    }, 200); // 200ms delay to let state settle

    setRedirectTimeout(timeout);

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isAuthenticated, isLoading, isDeviceActivated, hasRedirected]);

  // Reset redirect flag when auth states change (for re-evaluation)
  useEffect(() => {
    if (hasRedirected && !isLoading) {
      // If we've already redirected but auth state changed, allow re-evaluation
      const resetTimeout = setTimeout(() => {
        setHasRedirected(false);
      }, 500);
      
      return () => clearTimeout(resetTimeout);
    }
  }, [isAuthenticated, isDeviceActivated]);

  // Show loading screen while checking authentication
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.burgundy[500]} />
      <Text style={styles.loadingText}>
        {isLoading ? 'Checking authentication...' : 'Redirecting...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.burgundy[500],
    textAlign: 'center',
  },
});