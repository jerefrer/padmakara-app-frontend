import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { REVIEW_CODE_MAX_LENGTH, useMagicLinkSignIn, type SignInError } from '@/hooks/useMagicLinkSignIn';
import { useFocusRing } from '@/components/membership/focusRing';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c, fonts } from '@/components/membership/theme';

interface Props {
  /** "panel": the sheet or dialog, with a large title. "card": inside a page, smaller. */
  variant?: 'panel' | 'card';
  /** Replaces the default line under the title. */
  intro?: string;
  /** Leaving the form for the full-page access request (unknown address). */
  onLeave?: () => void;
  autoFocus?: boolean;
}

/**
 * Email → "check your email" → signed in, in place. The person never leaves the screen they
 * were on; opening the link on any device signs this one in.
 */
export function SignInForm({ variant = 'panel', intro, onLeave, autoFocus = false }: Props) {
  const { t } = useLanguage();
  const s = useMagicLinkSignIn({
    // An unknown address needs the access-request form, which keeps its full page.
    onApprovalRequired: (email) => {
      onLeave?.();
      router.push({ pathname: '/(auth)/magic-link', params: { email, approval: '1' } } as any);
    },
  });
  const ring = useFocusRing();
  const card = variant === 'card';
  const tx = (key: string, fallback: string, vars?: Record<string, unknown>) => {
    const v = t(`auth.signInPanel.${key}`, vars);
    if (v && v !== `auth.signInPanel.${key}`) return v;
    return vars ? fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? '')) : fallback;
  };
  const errorText: Record<SignInError, string> = {
    invalid: tx('invalid', 'Please enter a valid email address.'),
    generic: tx('error', 'Something went wrong. Please try again.'),
    network: tx('network', 'No connection. Please try again.'),
    badCode: tx('codeIncorrect', 'Incorrect code'),
  };

  if (s.phase === 'done') {
    return (
      <View testID="sign-in-done" style={styles.done}>
        <ActivityIndicator color={c.burgundy[500]} />
        <Text style={styles.body}>{tx('signedIn', 'You are signed in.')}</Text>
      </View>
    );
  }

  if (s.phase === 'code' || (s.phase === 'sending' && s.code !== '')) {
    const checking = s.phase === 'sending';
    return (
      <View testID="sign-in-code">
        <Text style={[styles.title, card && styles.titleCard]} accessibilityRole="header">
          {tx('codeLabel', 'Review code')}
        </Text>
        <Text style={styles.body}>
          {tx('codeHelp', 'This account signs in with a code provided to app reviewers.')}
        </Text>
        <TextInput
          testID="review-code-input"
          accessibilityLabel={tx('codeLabel', 'Review code')}
          value={s.code}
          onChangeText={s.setCode}
          onSubmitEditing={s.submitCode}
          maxLength={REVIEW_CODE_MAX_LENGTH}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="oneTimeCode"
          returnKeyType="go"
          autoFocus
          editable={!checking}
          onFocus={ring.onFocus}
          onBlur={ring.onBlur}
          style={[styles.input, styles.codeInput, ring.style]}
        />
        {s.error ? (
          <Text testID="review-code-error" style={styles.error} accessibilityLiveRegion="polite">
            {errorText[s.error]}
          </Text>
        ) : null}
        <Pressable
          testID="review-code-submit"
          accessibilityRole="button"
          disabled={checking}
          onPress={s.submitCode}
          style={({ pressed }) => [styles.submit, pressed && pageStyles.buttonPressed]}
        >
          {checking ? <ActivityIndicator color={c.white} /> : <Text style={pageStyles.buttonText}>{tx('submit', 'Continue')}</Text>}
        </Pressable>
        <View style={styles.links}>
          <Pressable testID="sign-in-another" accessibilityRole="button" onPress={s.reset} style={styles.linkHit}>
            <Text style={styles.link}>{tx('another', 'Use another address')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (s.phase === 'sent') {
    return (
      <View testID="sign-in-sent">
        <Text style={[styles.title, card && styles.titleCard]} accessibilityRole="header">
          {tx('sentTitle', 'Check your email')}
        </Text>
        <Text style={styles.body}>
          {tx('sentBefore', 'We sent a link to')} <Text style={styles.strong}>{s.sentTo}</Text>.{' '}
          {tx('sentAfter', 'Open it on any device: this screen signs in by itself.')}
        </Text>
        <View style={styles.waiting} accessibilityLiveRegion="polite">
          <View style={styles.dot} />
          <Text style={styles.waitingText}>{tx('waiting', 'Waiting for you to open the link…')}</Text>
        </View>
        <Text style={styles.hint}>
          {s.resent ? tx('resent', 'Sent again.') : tx('spam', 'Nothing after a minute? Look in the spam folder.')}
        </Text>
        {s.error ? <Text style={styles.error}>{errorText[s.error]}</Text> : null}
        <View style={styles.links}>
          <Pressable
            testID="sign-in-resend"
            accessibilityRole="button"
            disabled={s.cooldown > 0}
            onPress={s.resend}
            style={styles.linkHit}
          >
            <Text style={[styles.link, s.cooldown > 0 && styles.linkOff]}>
              {s.cooldown > 0
                ? tx('resendIn', 'Resend in {{seconds}}s', { seconds: s.cooldown })
                : tx('resend', 'Resend email')}
            </Text>
          </Pressable>
          <Pressable testID="sign-in-another" accessibilityRole="button" onPress={s.reset} style={styles.linkHit}>
            <Text style={styles.link}>{tx('another', 'Use another address')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const sending = s.phase === 'sending';
  return (
    <View testID="sign-in-form">
      <Text style={[styles.title, card && styles.titleCard]} accessibilityRole="header">
        {tx('title', 'Sign in')}
      </Text>
      <Text style={styles.body}>{intro ?? tx('intro', "We'll email you a link. No password to remember.")}</Text>
      <Text nativeID="sign-in-email-label" style={styles.label}>
        {tx('emailLabel', 'Email')}
      </Text>
      <TextInput
        testID="sign-in-email"
        accessibilityLabel={tx('emailLabel', 'Email')}
        accessibilityLabelledBy="sign-in-email-label"
        value={s.email}
        onChangeText={s.setEmail}
        onSubmitEditing={s.submit}
        placeholder="your.email@example.com"
        placeholderTextColor={c.gray[400]}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        autoFocus={autoFocus}
        editable={!sending}
        onFocus={ring.onFocus}
        onBlur={ring.onBlur}
        style={[styles.input, ring.style]}
      />
      <Text style={styles.fieldHint}>{tx('hint', "If this device isn't recognised, we'll email you a link.")}</Text>
      {s.error ? (
        <Text testID="sign-in-error" style={styles.error} accessibilityLiveRegion="polite">
          {errorText[s.error]}
        </Text>
      ) : null}
      <Pressable
        testID="sign-in-submit"
        accessibilityRole="button"
        disabled={sending}
        onPress={s.submit}
        style={({ pressed }) => [styles.submit, pressed && pageStyles.buttonPressed]}
      >
        {sending ? <ActivityIndicator color={c.white} /> : <Text style={pageStyles.buttonText}>{tx('submit', 'Continue')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontFamily: 'MinionPro',
    color: c.burgundy[500],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  titleCard: { fontSize: 22, color: c.gray[800], fontFamily: fonts.display, fontVariant: undefined, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, color: c.gray[600] },
  strong: { color: c.gray[800], fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: c.gray[700], marginTop: 18, marginBottom: 6 },
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
  codeInput: { marginTop: 18, letterSpacing: 2 },
  fieldHint: { fontSize: 13, lineHeight: 18, color: c.gray[500], marginTop: 8 },
  error: { fontSize: 14, color: c.red[700], marginTop: 8 },
  submit: {
    height: 50,
    marginTop: 14,
    backgroundColor: c.burgundy[500],
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    padding: 14,
    backgroundColor: c.cream[200],
    borderWidth: 1,
    borderColor: c.gray[200],
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b' },
  waitingText: { fontSize: 14, color: c.gray[600] },
  hint: { fontSize: 13, color: c.gray[500], marginTop: 12 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, marginTop: 6 },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 15, fontWeight: '600', color: c.burgundy[500] },
  linkOff: { color: c.gray[400] },
  done: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
