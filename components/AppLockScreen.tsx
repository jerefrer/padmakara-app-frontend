import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { useLanguage } from '@/contexts/LanguageContext';
import { kindLabels, type BiometricKind } from '@/services/appLock';
import { colors } from '@/constants/colors';

interface Props {
  kind: BiometricKind | null;
  onUnlock: () => void;
  /** The lock is still being decided at cold start: cover the app, but ask nothing yet. */
  pending?: boolean;
  /** The system prompt is open: say so instead of offering the button. */
  prompting?: boolean;
  /** Called once the cover is on screen, so the native splash can lift without a gap. */
  onShown?: () => void;
}

const GLYPH_SIZE = 56;

/** The device's own biometric glyph: Apple's Face ID / Touch ID symbols on iOS, Ionicons elsewhere. */
function BiometricGlyph({ kind }: { kind: BiometricKind | null }) {
  const usesFace = kind === 'faceId';
  const fallback = (
    <Ionicons name={usesFace ? 'scan-outline' : 'finger-print'} size={GLYPH_SIZE} color={colors.white} />
  );
  if (kind !== 'faceId' && kind !== 'touchId') return fallback;
  return (
    <SymbolView
      name={usesFace ? 'faceid' : 'touchid'}
      tintColor={colors.white}
      weight="light"
      resizeMode="scaleAspectFit"
      fallback={fallback}
      style={styles.glyph}
    />
  );
}

/**
 * Full-screen cover shown while the app lock is on and nobody has unlocked yet. It is a Modal so it
 * also covers any modal already open (the full-screen player) when the lock comes back. It carries
 * the launch screen's lockup on the same burgundy.
 */
export function AppLockScreen({ kind, onUnlock, pending = false, prompting = false, onShown }: Props) {
  const { t } = useLanguage();
  const labels = kindLabels(kind);
  const unlockLabel = t(labels.unlockKey) || labels.unlockFallback;

  return (
    // Closing it with the Android back button would skip the lock.
    <Modal visible animationType="none" statusBarTranslucent onShow={onShown} onRequestClose={() => undefined}>
      <View testID="app-lock-screen" style={styles.cover} accessibilityViewIsModal>
        <Image
          source={require('@/assets/images/splash.png')}
          style={styles.lockup}
          resizeMode="contain"
          accessibilityLabel="Padmakara"
        />
        {pending ? null : (
          <View style={styles.action}>
            {prompting ? (
              <View testID="app-lock-prompting" style={styles.prompting}>
                <BiometricGlyph kind={kind} />
                <Text style={styles.status}>{t('appLock.unlocking') || 'Unlocking…'}</Text>
              </View>
            ) : (
              <Pressable
                testID="app-lock-unlock"
                accessibilityRole="button"
                accessibilityLabel={unlockLabel}
                onPress={onUnlock}
                style={({ pressed }) => [styles.unlock, pressed && styles.unlockPressed]}
              >
                <BiometricGlyph kind={kind} />
                <View style={styles.button}>
                  <Text style={styles.buttonText}>{unlockLabel}</Text>
                </View>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cover: {
    flex: 1,
    // The launch screen's background (app.config.ts, expo-splash-screen).
    backgroundColor: colors.burgundy[500],
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  // In the upper third: the system Face ID prompt opens in the middle of the screen and
  // would hide a centred lockup.
  lockup: {
    marginTop: '22%',
    // The splash image's aspect ratio (1800 × 1766).
    width: 220,
    height: 216,
  },
  // Below the lockup, clear of the system Face ID prompt in the middle of the screen.
  action: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 96,
    alignItems: 'center',
  },
  prompting: {
    alignItems: 'center',
    gap: 16,
  },
  glyph: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
  },
  status: {
    fontFamily: 'EBGaramond_400Regular',
    fontSize: 18,
    color: colors.white,
    opacity: 0.85,
  },
  unlock: {
    alignItems: 'center',
    gap: 20,
  },
  unlockPressed: {
    opacity: 0.7,
  },
  button: {
    minHeight: 52,
    minWidth: 240,
    paddingHorizontal: 24,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 18,
    color: colors.white,
  },
});
