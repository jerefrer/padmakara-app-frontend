import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipColors as c } from '@/components/membership/theme';
import {
  DEFAULT_LOCK_SCREEN_BUTTONS,
  getLockScreenButtons,
  setLockScreenButtons,
  subscribeToLockScreenButtons,
  type LockScreenButtons,
} from '@/services/lockScreenButtonsPreference';
import { SettingsRow } from './ui';

/**
 * iOS only: the lock screen has room for two buttons beside play and pause, so the listener
 * picks between 15 seconds back / forward and previous / next track. (Android shows all four.)
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
    <>
      <SettingsRow
        testID="settings-lock-screen-buttons"
        icon="play-skip-forward-outline"
        title={t('lockScreen.buttons') || 'Lock screen buttons'}
      />
      {options.map((option) => (
        <SettingsRow
          key={option.value}
          testID={`lock-screen-buttons-${option.value}`}
          title={option.label}
          onPress={() => void setLockScreenButtons(option.value)}
          right={value === option.value ? <Ionicons name="checkmark" size={20} color={c.burgundy[500]} /> : <></>}
        />
      ))}
    </>
  );
}
