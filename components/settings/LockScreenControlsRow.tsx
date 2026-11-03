import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipColors as c } from '@/components/membership/theme';
import { isNotificationPermissionGranted, requestNotificationPermission } from '@/services/notificationPermission';
import { SettingsRow } from './ui';

/**
 * Android only: whether the lock-screen player can show (it is a notification), with a way to
 * turn it on. Once Android refuses to ask again, the button opens the phone's settings.
 */
export function LockScreenControlsRow() {
  const { t } = useLanguage();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [hint, setHint] = useState(false);
  const isAndroid = Platform.OS === 'android';

  const refresh = useCallback(async () => {
    setGranted(await isNotificationPermissionGranted());
  }, []);

  useEffect(() => {
    if (!isAndroid) return;
    void refresh();
    // The user may come back from the phone's settings.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [isAndroid, refresh]);

  if (!isAndroid || granted === null) return null;

  const turnOn = async () => {
    const result = await requestNotificationPermission();
    if (result === 'granted') {
      setHint(false);
      await refresh();
      return;
    }
    // Denied, or Android will not show the prompt again: only the phone's settings can help.
    setHint(true);
    await Linking.openSettings().catch(() => undefined);
  };

  const label = t('lockScreen.title') || 'Lock-screen controls';
  return (
    <SettingsRow
      testID="settings-lock-screen-controls"
      icon="notifications-outline"
      title={label}
      subtitle={hint && !granted ? t('lockScreen.settingsHint') || "Allow notifications in your phone's settings." : undefined}
      right={
        granted ? (
          <Text style={styles.status}>{t('lockScreen.on') || 'On'}</Text>
        ) : (
          <>
            <Text style={styles.status}>{t('lockScreen.off') || 'Off'}</Text>
            <Pressable testID="lock-screen-turn-on" accessibilityRole="button" onPress={turnOn} style={styles.button}>
              <Text style={styles.buttonText}>{t('lockScreen.turnOn') || 'Turn on'}</Text>
            </Pressable>
          </>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  status: { fontSize: 14, color: c.gray[600], marginRight: 8 },
  button: { backgroundColor: c.burgundy[500], borderRadius: 2, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  buttonText: { color: c.white, fontSize: 14, fontWeight: '600' },
});
