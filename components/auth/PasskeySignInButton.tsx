import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { isPasskeySupported, signInWithPasskey } from '@/services/passkeyService';
import { membershipColors as c } from '@/components/membership/theme';

interface Props {
  onSignedIn?: () => void;
  /** Called when the button is pressed, before the system sheet opens (to drop a pending autofill request). */
  onStart?: () => void;
}

/**
 * "Sign in with Face ID / your fingerprint / a passkey", under the email form. Hidden when the
 * device cannot use passkeys. Cancelling the system sheet shows nothing; any other failure
 * leaves a quiet line, and the email form stays the way back.
 */
export function PasskeySignInButton({ onSignedIn, onStart }: Props) {
  const { t } = useLanguage();
  const { refreshAuth } = useAuth();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    isPasskeySupported().then((ok) => {
      if (mounted.current) setSupported(ok);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const tx = (key: string, fallback: string) => {
    const v = t(`auth.passkey.${key}`);
    return v && v !== `auth.passkey.${key}` ? v : fallback;
  };

  if (!supported) return null;

  const label =
    Platform.OS === 'ios'
      ? tx('signInIos', 'Sign in with Face ID')
      : Platform.OS === 'android'
        ? tx('signInAndroid', 'Sign in with your fingerprint')
        : tx('signInWeb', 'Sign in with a passkey');
  const icon = Platform.OS === 'ios' ? 'scan-outline' : Platform.OS === 'android' ? 'finger-print' : 'key-outline';

  const press = async () => {
    if (busy) return;
    onStart?.();
    setBusy(true);
    setFailed(false);
    const result = await signInWithPasskey();
    if (!mounted.current) return;
    if (result.ok) {
      await refreshAuth();
      if (mounted.current) onSignedIn?.();
      return;
    }
    setBusy(false);
    if (!result.cancelled) setFailed(true);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        testID="passkey-sign-in"
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={busy}
        onPress={press}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator color={c.burgundy[500]} />
        ) : (
          <>
            <Ionicons name={icon as any} size={20} color={c.burgundy[500]} />
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </Pressable>
      {failed ? (
        <Text testID="passkey-error" style={styles.quiet} accessibilityLiveRegion="polite">
          {tx('failed', "That didn't work. You can use your email instead.")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: c.burgundy[500],
    backgroundColor: c.white,
    borderRadius: 2,
    paddingHorizontal: 16,
  },
  pressed: { backgroundColor: c.cream[200] },
  label: { fontSize: 17, fontWeight: '600', color: c.burgundy[500] },
  quiet: { fontSize: 14, lineHeight: 20, color: c.gray[600], marginTop: 8, textAlign: 'center' },
});
