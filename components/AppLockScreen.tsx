import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { kindLabels, type BiometricKind } from '@/services/appLock';
import { colors } from '@/constants/colors';

interface Props {
  kind: BiometricKind | null;
  onUnlock: () => void;
}

/** Full-screen cover shown while the app lock is on and nobody has unlocked yet. */
export function AppLockScreen({ kind, onUnlock }: Props) {
  const { t } = useLanguage();
  const labels = kindLabels(kind);
  const unlockLabel = t(labels.unlockKey) || labels.unlockFallback;

  return (
    <View testID="app-lock-screen" style={styles.overlay} accessibilityViewIsModal>
      <Text style={styles.title}>PADMAKARA</Text>
      <Text style={styles.message}>{t('appLock.locked') || 'Locked'}</Text>
      <Pressable
        testID="app-lock-unlock"
        accessibilityRole="button"
        accessibilityLabel={unlockLabel}
        onPress={onUnlock}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>{unlockLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: '#fbf9f4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'EBGaramond_500Medium',
    fontSize: 28,
    color: colors.burgundy[500],
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontFamily: 'EBGaramond_400Regular',
    fontSize: 18,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    minHeight: 52,
    minWidth: 240,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.burgundy[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.burgundy[600],
  },
  buttonText: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 18,
    color: colors.white,
  },
});
