import React, { useEffect } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { hasUserName } from '@/utils/userName';
import { NameForm } from '@/components/auth/NameForm';
import { membershipColors as c } from '@/components/membership/theme';

/**
 * Screens that stay reachable without a name: leaving the account, the policy it points to,
 * and the sign-in screens themselves.
 */
const EXEMPT_PATHS = ['/delete-account', '/account-deletion', '/privacy-policy', '/magic-link', '/check-email', '/device-activated'];

/**
 * "What's your name?" over the whole app, for a signed-in account that has no name yet (the
 * API creates accounts from an email alone). An overlay rather than a route, so no redirect
 * can loop and the person lands exactly where they were once the name is saved. It never
 * shows to signed-out visitors, and a failed save keeps the step open with the error.
 */
export function NameGate() {
  const { t } = useLanguage();
  const { isAuthenticated, user, updateUser } = useAuth();
  const pathname = usePathname();
  const open = isAuthenticated && !!user && !hasUserName(user) && !EXEMPT_PATHS.includes(pathname);

  // Android Back would otherwise pop the screen hidden underneath.
  useEffect(() => {
    if (!open || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [open]);

  if (!open) return null;

  return (
    <View testID="name-step" style={styles.overlay} accessibilityViewIsModal>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title} accessibilityRole="header">
              {t('auth.nameStep.title') || "What's your name?"}
            </Text>
            <Text style={styles.body}>
              {t('auth.nameStep.intro') || "We'd like to know who is listening. You can change it later in Settings."}
            </Text>
            <NameForm
              autoFocus
              submitLabel={t('auth.nameStep.continue') || 'Continue'}
              errorText={t('auth.nameStep.error') || 'Your name could not be saved. Please try again.'}
              onSubmit={({ firstName, lastName }) => updateUser({ first_name: firstName, last_name: lastName })}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: c.white },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  title: {
    fontSize: 28,
    fontFamily: 'MinionPro',
    color: c.burgundy[500],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  body: { fontSize: 15, lineHeight: 22, color: c.gray[600] },
});
