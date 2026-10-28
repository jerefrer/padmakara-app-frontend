import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { membershipColors as c } from '@/components/membership/theme';
import { SignInForm } from './SignInForm';
import { PasskeyInviteGate } from './PasskeyInviteGate';

interface SignInContextValue {
  /** Opens sign-in over the current screen. `returnTo` only matters for the full-page fallback. */
  openSignIn: (opts?: { returnTo?: string }) => void;
}

// Outside the provider (tests, screens mounted before it) sign-in stays the full page.
const SignInContext = createContext<SignInContextValue>({
  openSignIn: (opts) =>
    router.push(
      (opts?.returnTo
        ? { pathname: '/(auth)/magic-link', params: { returnTo: opts.returnTo } }
        : '/(auth)/magic-link') as any,
    ),
});

export function useSignIn(): SignInContextValue {
  return useContext(SignInContext);
}

/**
 * Sign-in over the app instead of in place of it: a dialog on desktop, a sheet on a phone browser,
 * a page sheet (swipe down to close) in the native app. The screen underneath stays put, so once
 * signed in the person is exactly where they were.
 */
export function SignInProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, isDeviceActivated } = useAuth();

  useEffect(() => {
    if (open && isAuthenticated && isDeviceActivated) setOpen(false);
  }, [open, isAuthenticated, isDeviceActivated]);

  const openSignIn = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openSignIn }), [openSignIn]);

  return (
    <SignInContext.Provider value={value}>
      {children}
      <PasskeyInviteGate />
      {open ? <SignInModal onClose={() => setOpen(false)} /> : null}
    </SignInContext.Provider>
  );
}

function SignInModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { isMobile } = useDesktopLayout();
  const closeLabel = t('auth.signInPanel.close') || 'Close';

  const closeButton = (
    <Pressable
      testID="sign-in-close"
      accessibilityRole="button"
      accessibilityLabel={closeLabel}
      onPress={onClose}
      hitSlop={8}
      style={styles.close}
    >
      <Ionicons name="close" size={24} color={c.gray[500]} />
    </Pressable>
  );

  if (Platform.OS !== 'web') {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.nativeSheet} keyboardShouldPersistTaps="handled">
            <View style={styles.grabber} />
            {closeButton}
            <SignInForm onLeave={onClose} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, isMobile && styles.backdropSheet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          testID="sign-in-dialog"
          accessibilityViewIsModal
          {...({ role: 'dialog', 'aria-modal': true } as any)}
          style={[styles.dialog, isMobile && styles.sheet]}
        >
          {closeButton}
          <SignInForm onLeave={onClose} autoFocus={!isMobile} />
          <Text style={styles.footnote}>{t('auth.signInPanel.stayHere') || 'You stay on this page.'}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.white },
  nativeSheet: { padding: 24, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.gray[300], marginBottom: 22 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  backdropSheet: { justifyContent: 'flex-end', padding: 0 },
  dialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: c.white,
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  sheet: {
    maxWidth: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 34,
  },
  close: { position: 'absolute', top: 10, right: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  footnote: { fontSize: 13, color: c.gray[500], marginTop: 16 },
});
