import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Platform,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import apiService from '@/services/apiService';
import { API_ENDPOINTS } from '@/services/apiConfig';
import { BackButton } from '@/components/ui/BackButton';

/**
 * Public page (no sign-in) for deleting a Padmakara account. It is the URL listed in
 * Google Play's data-deletion form: app.padmakara.pt/account-deletion.
 *
 *  - without `?token=`: explains what is deleted, takes an email, asks the API to send a
 *    confirmation link (the API answers the same whether or not the account exists);
 *  - with `?token=`: the link from that email — a confirm button that deletes for good.
 */
type Step = 'form' | 'sent' | 'confirm' | 'done';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountDeletionScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { isAuthenticated, logout } = useAuth();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [step, setStep] = useState<Step>(token ? 'confirm' : 'form');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);

  const tr = (key: string, fallback: string) => t(`accountDeletionPage.${key}`) || fallback;

  const handleRequest = async () => {
    if (busy) return;
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(tr('emailInvalid', 'Please enter a valid email address.'));
      return;
    }
    setBusy(true);
    setError(null);
    const response = await apiService.post(API_ENDPOINTS.ACCOUNT_DELETION_REQUEST, {
      email: trimmed,
      language,
    });
    setBusy(false);
    if (!response.success) {
      setError(tr('requestError', 'We could not send the request. Please try again.'));
      return;
    }
    setStep('sent');
  };

  const handleConfirm = async () => {
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    const response = await apiService.post(API_ENDPOINTS.ACCOUNT_DELETION_CONFIRM, { token });
    setBusy(false);
    if (!response.success) {
      if (response.code === 'INVALID_TOKEN') {
        setLinkInvalid(true);
        setError(tr('errorInvalid', 'This link is invalid or has expired. Please request a new one.'));
      } else if (response.code === 'ADMIN_ACCOUNT') {
        setError(tr('errorAdmin', 'This account cannot be deleted from here. Please contact the Association.'));
      } else if (response.code === 'PAYMENT_CANCEL_FAILED') {
        setError(
          tr('errorPayment', 'We could not cancel your recurring payment, so nothing was deleted. Please try again in a few minutes.'),
        );
      } else {
        setError(tr('errorGeneric', 'We could not delete the account. Please try again.'));
      }
      return;
    }
    // If this device was signed in as the account that is now gone, drop the stale session.
    if (isAuthenticated) {
      try {
        await logout();
      } catch (err) {
        console.warn('Logout after account deletion failed:', err);
      }
    }
    setStep('done');
  };

  const requestNewLink = () => {
    setError(null);
    setLinkInvalid(false);
    setEmail('');
    setStep('form');
  };

  const info = (title: string, body: string) => (
    <View style={styles.infoBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );

  const errorBox = error ? (
    <View style={styles.errorContainer} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={16} color="#dc2626" />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton variant="inline" style={styles.headerBack} disabled={busy} />
        <Text style={styles.headerTitle}>{tr('title', 'Delete your Padmakara account')}</Text>
        <Pressable
          style={styles.langButton}
          onPress={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
          accessibilityRole="button"
        >
          <Text style={styles.langText}>{tr('switchLanguage', language === 'pt' ? 'English' : 'Português')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {step === 'form' && (
          <>
            <Text style={styles.pageTitle}>{tr('title', 'Delete your Padmakara account')}</Text>
            <Text style={styles.lead}>
              {tr(
                'intro',
                'This page explains how to delete your account for the Padmakara app, run by Associação Padmakara Portugal. You can do it without opening the app.',
              )}
            </Text>

            {info(
              tr('inAppTitle', 'From the app'),
              tr('inApp', 'Open the Padmakara app and go to Settings, then Delete account.'),
            )}
            {info(
              tr('whatDeletedTitle', 'What is deleted'),
              tr(
                'whatDeleted',
                'Your account, your name and email address, your registered devices, your listening and viewing progress, your bookmarks and your access to retreat content. This cannot be undone.',
              ),
            )}
            {info(
              tr('whatKeptTitle', 'What is kept'),
              tr(
                'whatKept',
                'Records of payments made to the Association are kept, without your personal details, because Portuguese accounting law requires us to keep them for several years. Any recurring payment is cancelled.',
              ),
            )}
            {info(
              tr('fromPageTitle', 'From this page'),
              tr(
                'fromPageBody',
                'Enter the email address of your Padmakara account. If an account exists, we will email you a confirmation link that is valid for one hour. Nothing is deleted until you use that link.',
              ),
            )}

            <Text style={styles.inputLabel}>{tr('emailLabel', 'Email address of your account')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={tr('emailPlaceholder', 'you@example.com')}
              placeholderTextColor={colors.gray[400]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!busy}
              onSubmitEditing={handleRequest}
              accessibilityLabel={tr('emailLabel', 'Email address of your account')}
            />
            {errorBox}
            <Pressable
              style={[styles.primaryButton, busy && styles.buttonBusy]}
              onPress={handleRequest}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>{tr('sendButton', 'Send confirmation link')}</Text>
              )}
            </Pressable>
          </>
        )}

        {step === 'sent' && (
          <View style={styles.centered}>
            <Ionicons name="mail-outline" size={48} color={colors.burgundy[500]} />
            <Text style={styles.pageTitle}>{tr('sentTitle', 'Check your email')}</Text>
            <Text style={styles.lead}>
              {tr(
                'sentBody',
                'If an account exists for this address, we have sent a confirmation link. It is valid for one hour.',
              )}
            </Text>
          </View>
        )}

        {step === 'confirm' && (
          <>
            <View style={styles.centered}>
              <Ionicons name="warning" size={48} color="#dc2626" />
              <Text style={styles.pageTitle}>{tr('confirmTitle', 'Confirm account deletion')}</Text>
              <Text style={styles.lead}>
                {tr(
                  'confirmWarning',
                  'You are about to permanently delete your Padmakara account and all of its personal data. This cannot be undone.',
                )}
              </Text>
            </View>
            {info(
              tr('whatKeptTitle', 'What is kept'),
              tr(
                'whatKept',
                'Records of payments made to the Association are kept, without your personal details, because Portuguese accounting law requires us to keep them for several years. Any recurring payment is cancelled.',
              ),
            )}
            {errorBox}
            {linkInvalid ? (
              <Pressable style={styles.primaryButton} onPress={requestNewLink} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>{tr('requestNewLink', 'Request a new link')}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.deleteButton, busy && styles.buttonBusy]}
                onPress={handleConfirm}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color="#ffffff" />
                    <Text style={styles.primaryButtonText}>
                      {tr('confirmButton', 'Delete my account permanently')}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </>
        )}

        {step === 'done' && (
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.burgundy[500]} />
            <Text style={styles.pageTitle}>{tr('doneTitle', 'Your account has been deleted')}</Text>
            <Text style={styles.lead}>
              {tr('doneBody', 'Your account and personal data have been deleted. Thank you for being part of Padmakara.')}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream[200] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.cream[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  headerBack: { marginLeft: 0 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.gray[800], textAlign: 'center' },
  langButton: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  langText: { fontSize: 14, color: colors.burgundy[500], fontWeight: '600' },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  centered: { alignItems: 'center', marginBottom: 12 },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray[800],
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  lead: { fontSize: 15, lineHeight: 24, color: colors.gray[600], textAlign: 'center', marginBottom: 28 },
  infoBlock: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.gray[800], marginBottom: 6 },
  body: { fontSize: 15, lineHeight: 23, color: colors.gray[600] },
  inputLabel: { fontSize: 15, fontWeight: '500', color: colors.gray[700], marginTop: 8, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.gray[800],
    backgroundColor: colors.white,
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 14, color: '#dc2626' },
  primaryButton: {
    backgroundColor: colors.burgundy[500],
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  buttonBusy: { opacity: 0.7 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  bottomSpacer: { height: 60 },
});
