import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { markHandled } from '@/hooks/usePasskeyInvite';
import { registerPasskey } from '@/services/passkeyService';
import { currentPasskeyWording } from '@/utils/passkeyWording';
import { membershipColors as c, fonts } from '@/components/membership/theme';

const SUCCESS_MS = 1800;
const QUIET_MS = 2200;

interface Props {
  userId: string;
  /** Called once, when the person is done with the invitation (any outcome). */
  onContinue: () => void;
}

type Stage = 'invite' | 'busy' | 'success' | 'quiet';

/**
 * The invitation to save a passkey. A designed moment, not a system dialog: no error states,
 * a cancelled or failed attempt is simply "Not now" with a quiet pointer to Settings.
 */
export function PasskeyInvite({ userId, onContinue }: Props) {
  const { t } = useLanguage();
  const { isMobile } = useDesktopLayout();
  const [stage, setStage] = useState<Stage>('invite');
  const mounted = useRef(true);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { device, method: methodKind, sync: syncKind, tablet: isPad } = currentPasskeyWording(
    Platform.OS,
    Platform.OS === 'ios' && Platform.isPad === true,
  );

  const tx = (key: string, fallback: string, vars?: Record<string, string>) => {
    const full = `auth.passkeyInvite.${key}`;
    const v = t(full, vars);
    const text = v && v !== full ? v : fallback;
    return vars ? text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '') : text;
  };

  const method = {
    ios: tx('method.ios', 'Face ID or Touch ID'),
    mac: tx('method.mac', 'Touch ID'),
    android: tx('method.android', 'your fingerprint or face'),
    desktop: tx('method.desktop', 'your fingerprint, face or PIN'),
    generic: tx('method.generic', 'your face or fingerprint'),
  }[methodKind];
  const deviceWord =
    device === 'other' || isPad
      ? tx('deviceWord.other', 'device')
      : device === 'ios' || device === 'android'
        ? tx('deviceWord.phone', 'phone')
        : tx('deviceWord.computer', 'computer');
  const bodyKey = { ios: 'bodyIos', android: 'bodyAndroid', mac: 'bodyDesktop', desktop: 'bodyDesktop', other: 'bodyGeneric' }[device];
  const bodyFallback = {
    bodyIos:
      'Save a key on this {{device}}. When you come back, on the website or on a new iPhone or iPad, a glance with {{method}} is enough. No more waiting for an email.',
    bodyAndroid:
      'Save a key on this phone. When you come back, on the website or on a new phone, a glance with {{method}} is enough. No more waiting for an email.',
    bodyDesktop:
      'Save a key on this computer. When you come back to the website, {{method}} is enough. No more waiting for an email.',
    bodyGeneric:
      'Save a key on this device. When you come back, on the website or on a new device, {{method}} is enough. No more waiting for an email.',
  }[bodyKey] as string;
  const sync = {
    apple: tx('pointApple', 'Works with your other Apple devices'),
    google: tx('pointGoogle', 'Works on your other devices with your Google account'),
    other: tx('pointOther', 'Works on your other devices'),
  }[syncKind];
  const points = [tx('pointNothing', 'Nothing to remember'), tx('pointOnlyYou', 'Only you can use it'), sync];

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    mounted.current = true;
    // Shown is shown: whatever the person does next, it does not come back on this device.
    markHandled(userId);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [userId]);

  const later = () => finish();

  const accept = async () => {
    if (stage !== 'invite') return;
    setStage('busy');
    let ok = false;
    try {
      ok = (await registerPasskey()).ok;
    } catch {
      ok = false;
    }
    if (!mounted.current) return;
    setStage(ok ? 'success' : 'quiet');
    timer.current = setTimeout(finish, ok ? SUCCESS_MS : QUIET_MS);
  };

  const card = (
    <View style={[styles.card, !isMobile && styles.cardDesktop]} testID="passkey-invite">
      <View style={styles.circle}>
        <Ionicons name="key-outline" size={44} color={c.burgundy[500]} />
      </View>

      {stage === 'success' ? (
        <View testID="passkey-invite-success" style={styles.center} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={40} color={c.burgundy[500]} />
          <Text style={styles.confirmation}>{tx('success', 'Done. Next time, just use {{method}}.', { method })}</Text>
        </View>
      ) : (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {tx('title', 'Next time, sign in without an email')}
          </Text>
          <Text style={styles.body}>
            {tx(bodyKey, bodyFallback, { device: deviceWord, method })}
          </Text>
          <View style={styles.points}>
            {points.map((p) => (
              <View key={p} style={styles.point}>
                <Ionicons name="checkmark-circle-outline" size={24} color={c.burgundy[500]} />
                <Text style={styles.pointText}>{p}</Text>
              </View>
            ))}
          </View>

          {stage === 'quiet' ? (
            <Text testID="passkey-invite-quiet" style={styles.quiet} accessibilityLiveRegion="polite">
              {tx('quiet', 'You can set it up later in Settings.')}
            </Text>
          ) : (
            <>
              <Pressable
                testID="passkey-invite-accept"
                accessibilityRole="button"
                disabled={stage === 'busy'}
                onPress={accept}
                style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
              >
                {stage === 'busy' ? (
                  <ActivityIndicator color={c.white} />
                ) : (
                  <Text style={styles.primaryText}>{tx('accept', 'Yes, set it up')}</Text>
                )}
              </Pressable>
              <Pressable
                testID="passkey-invite-later"
                accessibilityRole="button"
                disabled={stage === 'busy'}
                onPress={later}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>{tx('later', 'Not now')}</Text>
              </Pressable>
              <Text style={styles.fine}>
                {tx('finePrint', 'Your {{device}} keeps it safely. You can remove it any time in Settings.', {
                  device: deviceWord,
                })}
              </Text>
            </>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={styles.ground}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {card}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: c.cream[200] },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 480, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 24 },
  cardDesktop: {
    backgroundColor: c.white,
    borderRadius: 4,
    paddingHorizontal: 48,
    paddingVertical: 48,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: c.cream[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
    color: c.burgundy[500],
    textAlign: 'center',
    marginBottom: 16,
  },
  body: { fontSize: 17, lineHeight: 26, color: c.gray[700], textAlign: 'center', marginBottom: 24 },
  points: { alignSelf: 'stretch', gap: 14, marginBottom: 32 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  pointText: { flex: 1, fontSize: 17, lineHeight: 24, color: c.gray[800] },
  primary: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: 2,
    backgroundColor: c.burgundy[500],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryPressed: { backgroundColor: c.burgundy[600] },
  primaryText: { color: c.white, fontSize: 18, fontFamily: fonts.display },
  secondary: { minHeight: 52, minWidth: 160, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: c.burgundy[500], fontSize: 17, fontWeight: '600' },
  fine: { fontSize: 14, lineHeight: 20, color: c.gray[500], textAlign: 'center', marginTop: 12 },
  quiet: { fontSize: 17, lineHeight: 24, color: c.gray[600], textAlign: 'center', marginTop: 4 },
  center: { alignItems: 'center', gap: 16, marginTop: 8 },
  confirmation: { fontSize: 20, lineHeight: 28, color: c.gray[800], textAlign: 'center' },
});
