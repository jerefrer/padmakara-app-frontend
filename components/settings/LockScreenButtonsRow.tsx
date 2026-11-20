import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipColors as c } from '@/components/membership/theme';
import { pageStyles } from '@/components/membership/pageStyles';
import {
  DEFAULT_LOCK_SCREEN_BUTTONS,
  getLockScreenButtons,
  setLockScreenButtons,
  subscribeToLockScreenButtons,
  type LockScreenButtons,
} from '@/services/lockScreenButtonsPreference';
import { Rows, SettingsRow } from './ui';

/**
 * iOS only: the lock screen has room for two buttons beside play and pause, so the listener
 * picks between 15 seconds back / forward and previous / next track. (Android shows all four.)
 * Drawn like the passkeys block: a caption, one line of explanation, then the choices with a
 * check on the current one.
 */
export function LockScreenButtonsRow() {
  const { t } = useLanguage();
  const [value, setValue] = useState<LockScreenButtons>(DEFAULT_LOCK_SCREEN_BUTTONS);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    void getLockScreenButtons().then((saved) => {
      if (!cancelled) setValue(saved);
    });
    const unsubscribe = subscribeToLockScreenButtons(setValue);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (Platform.OS !== 'ios') return null;

  const options: { value: LockScreenButtons; label: string }[] = [
    { value: 'seconds', label: t('lockScreen.buttonsSeconds') || '15 seconds back / forward' },
    { value: 'tracks', label: t('lockScreen.buttonsTracks') || 'Previous / next track' },
  ];

  return (
    <View testID="settings-lock-screen-buttons" style={styles.block}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('lockScreen.buttons') || 'Lock screen buttons'}
      </Text>
      <Text style={styles.explanation}>
        {t('lockScreen.buttonsExplanation') || 'Shown on the lock screen while listening.'}
      </Text>
      <Rows>
        {options.map((option) => (
          <SettingsRow
            key={option.value}
            testID={`lock-screen-buttons-${option.value}`}
            title={option.label}
            onPress={() => void setLockScreenButtons(option.value)}
            right={value === option.value ? <Ionicons name="checkmark" size={20} color={c.burgundy[500]} /> : <></>}
          />
        ))}
      </Rows>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 32 },
  heading: { ...(pageStyles.sectionLabel as object), marginTop: 0, marginBottom: 4 },
  explanation: { fontSize: 17, lineHeight: 24, color: c.gray[600], marginBottom: 12 },
});
