import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pageStyles } from './pageStyles';
import { membershipColors as c } from './theme';
import { tr } from './tr';

/** Native (reader-app) account state: access only. Never a price, a pay button or a website link. */
export function ReaderAccountStatus() {
  const { t } = useLanguage();
  const { isAuthenticated, hasActiveSubscription, user } = useAuth();

  return (
    <ScrollView style={styles.screen}>
      <View style={pageStyles.container}>
        <Text style={pageStyles.title} accessibilityRole="header">
          {tr(t, 'accountTitle', 'Account')}
        </Text>
        {isAuthenticated ? (
          <View style={styles.rows}>
            {user && (user.name || user.email) ? (
              <View testID="reader-row-who" style={pageStyles.row}>
                <View style={pageStyles.rowLeft}>
                  <Ionicons name="person-circle-outline" size={20} color={c.burgundy[500]} />
                  <Text style={pageStyles.rowTitle}>{user.name || user.email}</Text>
                </View>
                {user.name && user.email ? <Text style={pageStyles.rowValue}>{user.email}</Text> : null}
              </View>
            ) : null}
            <View testID="reader-row-access" style={pageStyles.row}>
              <View style={pageStyles.rowLeft}>
                <Ionicons name="ribbon-outline" size={20} color={c.burgundy[500]} />
                <Text style={pageStyles.rowTitle}>{tr(t, 'accessLabel', 'Access')}</Text>
              </View>
              <Text style={pageStyles.rowValue}>
                {hasActiveSubscription
                  ? tr(t, 'fullAccess', 'Full access')
                  : tr(t, 'publicOnly', 'Public content only')}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.signIn, pageStyles.button, pressed && pageStyles.buttonPressed]}
            onPress={() => router.push('/(auth)/magic-link' as any)}
          >
            <Text style={pageStyles.buttonText}>{tr(t, 'signIn', 'Sign in')}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream[100] },
  rows: { marginTop: 24, borderTopWidth: 1, borderTopColor: c.gray[200] },
  signIn: { marginTop: 24 },
});
