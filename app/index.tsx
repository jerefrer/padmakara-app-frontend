import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { router, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import magicLinkService from '@/services/magicLinkService';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    500: '#b91c1c',
  },
};

export default function RootIndex() {
  const { isAuthenticated, isLoading, isDeviceActivated, refreshAuth } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [redirectTimeout, setRedirectTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isAutoActivating, setIsAutoActivating] = useState(false);
  const params = useGlobalSearchParams();

  // Auto-activation effect - runs first if auto_activate parameter is present
  useEffect(() => {
    const autoActivateToken = params.auto_activate as string;
    
    if (autoActivateToken && !isAutoActivating && !isAuthenticated) {
      console.log('🔄 Auto-activation token detected:', autoActivateToken.substring(0, 20) + '...');
      setIsAutoActivating(true);
      
      // Attempt auto-activation
      handleAutoActivation(autoActivateToken);
    }
  }, [params.auto_activate, isAutoActivating, isAuthenticated]);

  const handleAutoActivation = async (token: string) => {
    try {
      console.log('🚀 Attempting auto-activation with token');
      
      const result = await magicLinkService.autoActivateDevice(token);
      
      if (result.success) {
        console.log('✅ Auto-activation successful, refreshing auth state');
        await refreshAuth();
        // The normal useEffect will handle redirect after auth refresh
      } else {
        console.warn('❌ Auto-activation failed:', result.error);
        // Fall back to normal authentication flow
        setIsAutoActivating(false);
      }
    } catch (error) {
      console.error('💥 Auto-activation error:', error);
      setIsAutoActivating(false);
    }
  };

  useEffect(() => {
    // Clear any existing redirect timeout
    if (redirectTimeout) {
      clearTimeout(redirectTimeout);
      setRedirectTimeout(null);
    }

    // Don't redirect while loading, if already redirected, or if auto-activating
    if (isLoading || hasRedirected || isAutoActivating) {
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
        {isAutoActivating ? 'Activating device...' : isLoading ? 'Checking authentication...' : 'Redirecting...'}
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