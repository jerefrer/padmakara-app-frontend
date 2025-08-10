import React, { useEffect, ReactNode } from 'react';
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

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading, isDeviceActivated } = useAuth();

  useEffect(() => {
    // Add delay to prevent competing with root index redirects
    const redirectTimer = setTimeout(() => {
      if (!isLoading && (!isAuthenticated || !isDeviceActivated)) {
        console.log('🔐 AuthGuard: User not authenticated, redirecting to login', {
          isAuthenticated,
          isDeviceActivated,
          isLoading
        });
        router.replace('/(auth)/magic-link');
      }
    }, 100); // Small delay to let root index handle initial routing

    return () => clearTimeout(redirectTimer);
  }, [isAuthenticated, isLoading, isDeviceActivated]);

  if (isLoading) {
    return fallback || (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.burgundy[500]} />
        <Text style={styles.loadingText}>Verifying authentication...</Text>
      </View>
    );
  }

  if (!isAuthenticated || !isDeviceActivated) {
    return fallback || (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.burgundy[500]} />
        <Text style={styles.loadingText}>Redirecting to login...</Text>
      </View>
    );
  }

  return <>{children}</>;
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