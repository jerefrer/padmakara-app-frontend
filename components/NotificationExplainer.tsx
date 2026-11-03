import React, { useEffect, useState } from 'react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { requestNotificationPermission, subscribeToExplainer } from '@/services/notificationPermission';

/**
 * Mounted once near the app root. Explains why the lock-screen player needs the notification
 * permission before the system prompt appears. Playback keeps going while it is shown.
 * Closing it any way other than Continue counts as "Not now"; the service has already
 * recorded that it was shown, so it never returns on its own.
 */
export function NotificationExplainer() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeToExplainer(() => setVisible(true)), []);

  return (
    <ConfirmationModal
      visible={visible}
      title={t('lockScreen.title') || 'Lock-screen controls'}
      message={
        t('lockScreen.explainerBody') ||
        "To pause, rewind or skip from the lock screen, allow Padmakara to show its player in notifications. We won't send you messages."
      }
      icon="notifications-outline"
      buttons={[
        { text: t('lockScreen.notNow') || 'Not now', style: 'cancel' },
        {
          text: t('lockScreen.continue') || 'Continue',
          style: 'default',
          onPress: () => {
            void requestNotificationPermission();
          },
        },
      ]}
      onClose={() => setVisible(false)}
    />
  );
}
