import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

const colors = {
  cream: {
    100: '#fefefe',
  },
  burgundy: {
    500: '#9b1b1b',
  },
};

export default function RootIndex() {
  const { isAuthenticated, isLoading, isDeviceActivated } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [redirectTimeout, setRedirectTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

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

        // Always redirect to tabs — public content is available without login
        console.log('➡️ Redirecting to main app (public content available without login)', {
          authenticated: isAuthenticated,
          deviceActivated: isDeviceActivated,
        });
        router.replace('/(tabs)/(groups)');
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

  // Note: Previously had a hasRedirected reset effect here that caused an infinite
  // redirect loop on web (reset every 500ms → repeated router.replace calls).
  // Removed because the single redirect to /(tabs)/(groups) is sufficient.

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