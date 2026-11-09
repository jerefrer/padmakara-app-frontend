import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFocusRing } from '@/components/membership/focusRing';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';

interface Props {
  initialFirstName?: string;
  initialLastName?: string;
  submitLabel: string;
  errorText: string;
  /** Resolves with the outcome; the form stays open and shows `errorText` when it fails. */
  onSubmit: (name: { firstName: string; lastName: string }) => Promise<{ success: boolean }>;
  onCancel?: () => void;
  autoFocus?: boolean;
}

/**
 * First name (required) and last name, with a submit button. Shared by the Settings
 * name editor and the step that asks for a name after sign-in.
 */
export function NameForm({
  initialFirstName = '',
  initialLastName = '',
  submitLabel,
  errorText,
  onSubmit,
  onCancel,
  autoFocus = false,
}: Props) {
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const firstRing = useFocusRing();
  const lastRing = useFocusRing();
  const canSubmit = firstName.trim() !== '' && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setFailed(false);
    let ok = false;
    try {
      ok = (await onSubmit({ firstName: firstName.trim(), lastName: lastName.trim() })).success;
    } catch {
      ok = false;
    }
    setFailed(!ok);
    setBusy(false);
  };

  const firstLabel = t('settings.firstName') || 'First name';
  const lastLabel = t('settings.lastName') || 'Last name';

  return (
    <View testID="name-form">
      <Text style={styles.label}>{firstLabel}</Text>
      <TextInput
        testID="name-first"
        accessibilityLabel={firstLabel}
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        autoFocus={autoFocus}
        editable={!busy}
        onFocus={firstRing.onFocus}
        onBlur={firstRing.onBlur}
        style={[styles.input, firstRing.style]}
      />
      <Text style={styles.label}>{lastLabel}</Text>
      <TextInput
        testID="name-last"
        accessibilityLabel={lastLabel}
        value={lastName}
        onChangeText={setLastName}
        onSubmitEditing={submit}
        autoCapitalize="words"
        autoComplete="family-name"
        textContentType="familyName"
        returnKeyType="done"
        editable={!busy}
        onFocus={lastRing.onFocus}
        onBlur={lastRing.onBlur}
        style={[styles.input, lastRing.style]}
      />
      {failed ? (
        <Text testID="name-error" style={styles.error} accessibilityLiveRegion="polite">
          {errorText}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          testID="name-submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={submit}
          style={({ pressed }) => [styles.submit, !canSubmit && styles.submitOff, pressed && pageStyles.buttonPressed]}
        >
          {busy ? <ActivityIndicator color={c.white} /> : <Text style={pageStyles.buttonText}>{submitLabel}</Text>}
        </Pressable>
        {onCancel ? (
          <Pressable testID="name-cancel" accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.cancelHit}>
            <Text style={styles.cancel}>{t('common.cancel') || 'Cancel'}</Text>
          </Pressable>
        ) : null}
      </View>
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
    color: c.gray[800],
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  error: { fontSize: 14, color: c.red[700], marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', columnGap: 22, marginTop: 14 },
  submit: {
    height: 50,
    minWidth: 120,
    paddingHorizontal: 28,
    backgroundColor: c.burgundy[500],
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitOff: { opacity: 0.4 },
  cancelHit: { minHeight: 44, justifyContent: 'center' },
  cancel: { fontSize: 15, fontWeight: '600', color: c.burgundy[500] },
});
