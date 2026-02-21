import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const colors = {
  cream: { 100: '#fcf8f3' },
  burgundy: { 500: '#b91c1c', 600: '#991b1b' },
  green: { 500: '#16a34a' },
  gray: { 600: '#4b5563' },
};

export default function SubscriptionSuccessScreen() {
  const { refreshAuth } = useAuth();
  const { t } = useLanguage();

  // Refresh auth state so subscription is reflected immediately
  useEffect(() => {
    refreshAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Ionicons name="checkmark-circle" size={64} color={colors.green[500]} />
      <Text style={styles.title}>{t('subscription.success') || 'Subscription Activated!'}</Text>
      <Text style={styles.description}>
        {t('subscription.successDescription') || 'You now have access to all retreat recordings. Enjoy your practice!'}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.burgundy[600] }]}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.buttonText}>{t('subscription.goToApp') || 'Go to App'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
