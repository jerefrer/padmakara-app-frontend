import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import apiService from '@/services/apiService';
import { API_ENDPOINTS } from '@/services/apiConfig';
import { router, useFocusEffect } from 'expo-router';

const colors = {
  cream: { 100: '#fefefe' },
  burgundy: { 50: '#f8f1f1', 500: '#9b1b1b', 600: '#7b1616' },
  green: { 500: '#16a34a', 50: '#f0fdf4' },
  gray: { 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#2c2c2c' },
};

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, hasActiveSubscription, refreshUserData } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  // Refresh user data (including subscription status) when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshUserData();
      }
    }, [isAuthenticated])
  );

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      router.push({ pathname: '/(auth)/magic-link', params: { returnTo: '/(tabs)/subscription' } });
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post<{ url: string }>(API_ENDPOINTS.PAYMENT_SUBSCRIBE);
      if (response.data?.url) {
        if (Platform.OS === 'web') {
          window.location.href = response.data.url;
        } else {
          await Linking.openURL(response.data.url);
        }
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setLoading(true);
    try {
      const response = await apiService.post<{ url: string }>(API_ENDPOINTS.PAYMENT_CANCEL);
      if (response.data?.url) {
        if (Platform.OS === 'web') {
          window.location.href = response.data.url;
        } else {
          await Linking.openURL(response.data.url);
        }
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.centered}>
          <Ionicons name="card-outline" size={48} color={colors.gray[400]} />
          <Text style={styles.title}>{t('subscription.status') || 'Subscription'}</Text>
          <Text style={styles.description}>
            {t('subscription.registerCta') || 'Retreat participants can sign in to access their group\'s recordings.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => router.push({ pathname: '/(auth)/magic-link', params: { returnTo: '/(tabs)/subscription' } })}
          >
            <Text style={styles.primaryButtonText}>{t('groups.signIn') || 'Sign In'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Active subscription via Easypay (self-manageable)
  if (hasActiveSubscription && user?.subscription?.source === 'easypay') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.centered}>
          <Ionicons name="checkmark-circle" size={48} color={colors.green[500]} />
          <Text style={styles.title}>{t('subscription.active') || 'Active Subscription'}</Text>
          {user.subscription.expiresAt && (
            <Text style={styles.description}>
              {t('subscription.expiresOn') || 'Renews'}: {new Date(user.subscription.expiresAt).toLocaleDateString()}
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={handleCancelSubscription}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {t('subscription.manage') || 'Manage Subscription'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Active subscription via admin/cash (non-Easypay)
  if (hasActiveSubscription) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.centered}>
          <Ionicons name="checkmark-circle" size={48} color={colors.green[500]} />
          <Text style={styles.title}>{t('subscription.active') || 'Active Subscription'}</Text>
          {user?.subscription?.expiresAt && (
            <Text style={styles.description}>
              {t('subscription.expiresOn') || 'Expires'}: {new Date(user.subscription.expiresAt).toLocaleDateString()}
            </Text>
          )}
          <Text style={styles.description}>
            {t('subscription.contactUs') || 'Contact us to manage your subscription'}
          </Text>
        </ScrollView>
      </View>
    );
  }

  // No subscription — show subscribe CTA
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.centered}>
        <Ionicons name="card-outline" size={48} color={colors.burgundy[500]} />
        <Text style={styles.title}>{t('subscription.status') || 'Subscription'}</Text>
        <Text style={styles.description}>
          {t('subscription.subscribeCta') || 'Subscribe to access retreat recordings'}
        </Text>
        <Text style={styles.price}>{t('subscription.price') || '5\u20AC/month'}</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('subscription.subscribe') || 'Subscribe'}</Text>
          )}
        </Pressable>

        {Platform.OS !== 'web' && (
          <Text style={styles.webNote}>
            {t('subscription.manageOnWeb') || 'Manage your subscription at app.padmakara.pt'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.burgundy[500],
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'EBGaramond_700Bold',
    color: colors.gray[800],
    marginVertical: 16,
  },
  primaryButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
    minWidth: 180,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.burgundy[500],
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    minWidth: 180,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.burgundy[500],
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  webNote: {
    fontSize: 14,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
});
