import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipColors as c, fonts } from './theme';
import { tr } from './tr';

/** Native (reader-app) account state: access only. Never a price, a pay button or a website link. */
export function ReaderAccountStatus() {
  const { t } = useLanguage();
  const { isAuthenticated, hasActiveSubscription, user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {tr(t, 'accountTitle', 'Account')}
      </Text>
      {isAuthenticated ? (
        <View style={styles.card}>
          <Text style={[styles.status, hasActiveSubscription ? styles.ok : styles.neutral]}>
            {hasActiveSubscription
              ? tr(t, 'fullAccess', 'Full access')
              : tr(t, 'publicOnly', 'Public content only')}
          </Text>
          {user && (
            <Text style={styles.who}>
              {[user.name, user.email].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => router.push('/(auth)/magic-link' as any)}
        >
          <Text style={styles.buttonText}>{tr(t, 'signIn', 'Sign in')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: c.cream[100] },
  title: { fontSize: 28, fontFamily: fonts.display, fontWeight: '600', color: c.burgundy[500] },
  card: { backgroundColor: c.white, borderRadius: 10, borderWidth: 1, borderColor: c.gray[200], padding: 16, gap: 6 },
  status: { fontSize: 16, fontWeight: '600' },
  ok: { color: c.green[700] },
  neutral: { color: c.gray[600] },
  who: { fontSize: 15, color: c.gray[700] },
  button: { backgroundColor: c.burgundy[500], borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: c.white, fontSize: 16, fontWeight: '600' },
});
