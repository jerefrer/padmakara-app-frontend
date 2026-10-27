import React, { useState } from 'react';
import { Text, StyleSheet, Platform, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import apiService from '@/services/apiService';
import { API_ENDPOINTS } from '@/services/apiConfig';
import { useFocusRing } from '@/components/membership/focusRing';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';
import { LegalBody, LegalPage, LegalSection, legalStyles } from '@/components/legal/LegalPage';
import { Segmented } from '@/components/settings/ui';

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
  const ring = useFocusRing();

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

  const keptSection = (
    <LegalSection title={tr('whatKeptTitle', 'What is kept')}>
      <LegalBody>
        {tr(
          'whatKept',
          'Records of payments made to the Association are kept, without your personal details, because Portuguese accounting law requires us to keep them for several years. Any recurring payment is cancelled.',
        )}
      </LegalBody>
    </LegalSection>
  );

  const errorBox = error ? (
    <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {error}
    </Text>
  ) : null;

  const languageSwitch = (
    <Segmented
      label={t('profile.language') || 'App Language'}
      value={language === 'pt' ? 'pt' : 'en'}
      onChange={setLanguage}
      options={[
        { value: 'en', label: 'English' },
        { value: 'pt', label: 'Português' },
      ]}
    />
  );

  const title =
    step === 'sent'
      ? tr('sentTitle', 'Check your email')
      : step === 'confirm'
        ? tr('confirmTitle', 'Confirm account deletion')
        : step === 'done'
          ? tr('doneTitle', 'Your account has been deleted')
          : tr('title', 'Delete your Padmakara account');

  return (
    <LegalPage title={title} headerRight={languageSwitch} backDisabled={busy}>
      {step === 'form' && (
        <>
          <LegalBody style={styles.lead}>
            {tr(
              'intro',
              'This page explains how to delete your account for the Padmakara app, run by Associação Padmakara Portugal. You can do it without opening the app.',
            )}
          </LegalBody>

          <LegalSection title={tr('inAppTitle', 'From the app')}>
            <LegalBody>{tr('inApp', 'Open the Padmakara app and go to Settings, then Delete account.')}</LegalBody>
          </LegalSection>
          <LegalSection title={tr('whatDeletedTitle', 'What is deleted')}>
            <LegalBody>
              {tr(
                'whatDeleted',
                'Your account, your name and email address, your registered devices, your listening and viewing progress, your bookmarks and your access to retreat content. This cannot be undone.',
              )}
            </LegalBody>
          </LegalSection>
          {keptSection}
          <LegalSection title={tr('fromPageTitle', 'From this page')}>
            <LegalBody>
              {tr(
                'fromPageBody',
                'Enter the email address of your Padmakara account. If an account exists, we will email you a confirmation link that is valid for one hour. Nothing is deleted until you use that link.',
              )}
            </LegalBody>
          </LegalSection>

          <Text style={legalStyles.fieldLabel}>{tr('emailLabel', 'Email address of your account')}</Text>
          <TextInput
            style={[styles.input, ring.style]}
            value={email}
            onChangeText={setEmail}
            placeholder={tr('emailPlaceholder', 'you@example.com')}
            placeholderTextColor={c.gray[400]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            editable={!busy}
            onSubmitEditing={handleRequest}
            onFocus={ring.onFocus}
            onBlur={ring.onBlur}
            accessibilityLabel={tr('emailLabel', 'Email address of your account')}
          />
          {errorBox}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && pageStyles.buttonPressed, busy && styles.busy]}
            onPress={handleRequest}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={pageStyles.buttonText}>{tr('sendButton', 'Send confirmation link')}</Text>
            )}
          </Pressable>
        </>
      )}

      {step === 'sent' && (
        <LegalBody style={styles.lead}>
          {tr(
            'sentBody',
            'If an account exists for this address, we have sent a confirmation link. It is valid for one hour.',
          )}
        </LegalBody>
      )}

      {step === 'confirm' && (
        <>
          <LegalBody style={styles.lead}>
            {tr(
              'confirmWarning',
              'You are about to permanently delete your Padmakara account and all of its personal data. This cannot be undone.',
            )}
          </LegalBody>
          {keptSection}
          {errorBox}
          {linkInvalid ? (
            <Pressable
              style={({ pressed }) => [styles.button, pressed && pageStyles.buttonPressed]}
              onPress={requestNewLink}
              accessibilityRole="button"
            >
              <Text style={pageStyles.buttonText}>{tr('requestNewLink', 'Request a new link')}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.button, styles.danger, pressed && styles.dangerPressed, busy && styles.busy]}
              onPress={handleConfirm}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={pageStyles.buttonText}>{tr('confirmButton', 'Delete my account permanently')}</Text>
              )}
            </Pressable>
          )}
        </>
      )}

      {step === 'done' && (
        <LegalBody style={styles.lead}>
          {tr('doneBody', 'Your account and personal data have been deleted. Thank you for being part of Padmakara.')}
        </LegalBody>
      )}
    </LegalPage>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: 8 },
  // Same field as the sign-in form.
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: c.gray[300],
    backgroundColor: c.white,
    paddingHorizontal: 14,
    fontSize: 17,
    color: c.gray[800],
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  error: { fontSize: 14, color: c.red[700], marginTop: 8 },
  button: { ...pageStyles.button, marginTop: 24, minWidth: 160, alignItems: 'center' },
  danger: { backgroundColor: c.red[700] },
  dangerPressed: { backgroundColor: '#991b1b' },
  busy: { opacity: 0.7 },
});
