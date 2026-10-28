import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { EMAIL_CODE_LENGTH, digitsOnly, type EmailCodeError } from '@/hooks/useEmailCodeSignIn';
import { useFocusRing } from '@/components/membership/focusRing';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called with the digits when 6 are entered, or when Continue is pressed. */
  onSubmit: (value: string) => void;
  error: EmailCodeError | null;
  busy: boolean;
}

/**
 * "Or enter the 6-digit code from the email": the typed alternative to opening the link.
 * Shared by the sign-in form and the full-page check-email screen.
 */
export function EmailCodeField({ value, onChange, onSubmit, error, busy }: Props) {
  const { t } = useLanguage();
  const ring = useFocusRing();
  const tx = (key: string, fallback: string) => {
    const v = t(`auth.signInPanel.${key}`);
    return v && v !== `auth.signInPanel.${key}` ? v : fallback;
  };
  const errorText: Record<EmailCodeError, string> = {
    badCode: tx('codeIncorrect', 'Incorrect code'),
    network: tx('network', 'No connection. Please try again.'),
    generic: tx('error', 'Something went wrong. Please try again.'),
  };
  const label = tx('emailCodeLabel', 'Or enter the 6-digit code from the email');

  const handleChange = (text: string) => {
    const digits = digitsOnly(text);
    onChange(digits);
    if (digits.length === EMAIL_CODE_LENGTH && !busy) onSubmit(digits);
  };

  return (
    <View testID="email-code">
      <Text nativeID="email-code-label" style={styles.label}>
        {label}
      </Text>
      <TextInput
        testID="email-code-input"
        accessibilityLabel={label}
        accessibilityLabelledBy="email-code-label"
        value={value}
        onChangeText={handleChange}
        onSubmitEditing={() => onSubmit(value)}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={EMAIL_CODE_LENGTH + 1}
        autoCorrect={false}
        returnKeyType="go"
        editable={!busy}
        placeholder="123456"
        placeholderTextColor={c.gray[400]}
        onFocus={ring.onFocus}
        onBlur={ring.onBlur}
        style={[styles.input, ring.style]}
      />
      {error ? (
        <Text testID="email-code-error" style={styles.error} accessibilityLiveRegion="polite">
          {errorText[error]}
        </Text>
      ) : null}
      <Pressable
        testID="email-code-submit"
        accessibilityRole="button"
        disabled={busy}
        onPress={() => onSubmit(value)}
        style={({ pressed }) => [styles.submit, pressed && pageStyles.buttonPressed]}
      >
        {busy ? <ActivityIndicator color={c.white} /> : <Text style={pageStyles.buttonText}>{tx('submit', 'Continue')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: c.gray[700], marginTop: 18, marginBottom: 6 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: c.gray[300],
    backgroundColor: c.white,
    paddingHorizontal: 14,
    fontSize: 17,
    letterSpacing: 4,
    color: c.gray[800],
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  error: { fontSize: 14, color: c.red[700], marginTop: 8 },
  submit: {
    height: 50,
    marginTop: 14,
    backgroundColor: c.burgundy[500],
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
