import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { kindLabels } from '@/services/appLock';
import { useLanguage } from '@/contexts/LanguageContext';
import videoPreferencesService from '@/services/videoPreferencesService';
import { StorageSection } from '@/components/StorageSection';
import { tr } from '@/components/membership/tr';
import { GroupLabel, Rows, SettingsRow, SwitchRow } from './ui';

type Button = { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };

// React Native's Alert does nothing on web, so the browser's confirm stands in for it there.
function showAlert(title: string, message: string, buttons?: Button[]) {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed && buttons) {
      const confirmButton = buttons.find((b) => b.style === 'destructive' || b.style !== 'cancel');
      confirmButton?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}

function storageErrorMessage(error: any): string {
  const message = error?.message || error?.toString() || 'Unknown error';
  if (Platform.OS === 'web') {
    if (message.includes('localStorage') || message.includes('storage')) {
      return 'Storage access blocked. Please check browser settings and allow storage for this site.';
    }
    if (message.includes('quota') || message.includes('QuotaExceededError')) {
      return 'Browser storage is full. Please clear browser data or try in incognito mode.';
    }
    return 'Web storage error. Please try refreshing the page or using a different browser.';
  }
  if (message.includes('AsyncStorage')) return 'Device storage error. Please restart the app and try again.';
  return 'Storage operation failed. Please restart the app and try again.';
}

/** Which tracks appear, and (native) whether videos may use mobile data. Stored on this device only. */
export function ListeningSection() {
  const { t, showPortuguese, setShowPortuguese } = useLanguage();
  const [warnOnCellular, setWarnOnCellular] = useState(true);
  const [allowOnCellular, setAllowOnCellular] = useState(true);
  const isNative = Platform.OS !== 'web';

  useEffect(() => {
    if (!isNative) return;
    Promise.all([videoPreferencesService.getWarnOnCellular(), videoPreferencesService.getAllowOnCellular()]).then(
      ([warn, allow]) => {
        setWarnOnCellular(warn);
        setAllowOnCellular(allow);
      },
    );
  }, [isNative]);

  return (
    <>
      <Rows>
        {/* An event's original language and English are always shown, so a Tibetan teaching is
            never reduced to its translation; only Portuguese is a choice. */}
        <SwitchRow
          testID="settings-show-portuguese"
          icon="headset-outline"
          title={t('profile.showPortuguese') || 'Show Portuguese tracks'}
          subtitle={t('profile.showPortugueseSubtitle') || "Each event's original language and English are always shown."}
          value={showPortuguese}
          onValueChange={setShowPortuguese}
        />
      </Rows>
      {isNative ? (
        <>
          <GroupLabel>{t('profile.videoPlayback') || 'Video Playback'}</GroupLabel>
          <Rows>
            <SwitchRow
              icon="cellular-outline"
              title={t('profile.allowVideoOnCellular') || 'Allow video on mobile data'}
              subtitle={t('profile.allowVideoOnCellularSubtitle') || 'Turn off to only play videos on Wi-Fi.'}
              value={allowOnCellular}
              onValueChange={(v) => {
                setAllowOnCellular(v);
                videoPreferencesService.setAllowOnCellular(v);
              }}
            />
            <SwitchRow
              icon="warning-outline"
              title={t('profile.warnOnCellular') || 'Warn before playing on mobile data'}
              subtitle={
                t('profile.warnOnCellularSubtitle') ||
                'Show a confirmation the first time you tap a video off Wi-Fi each session.'
              }
              value={warnOnCellular}
              disabled={!allowOnCellular}
              onValueChange={(v) => {
                setWarnOnCellular(v);
                videoPreferencesService.setWarnOnCellular(v);
              }}
            />
          </Rows>
        </>
      ) : null}
    </>
  );
}

export function OfflineSection() {
  return <StorageSection />;
}

/** The app lock (native) and signing out, which also forgets this device. */
export function SignInSection() {
  const { t } = useLanguage();
  const { forgetDevice } = useAuth();
  const { enabled: lockEnabled, kind, enable: enableLock, disable: disableLock } = useAppLock();
  const { clearTrack } = useAudioPlayerContext();
  const [isClearing, setIsClearing] = useState(false);
  const isNative = Platform.OS !== 'web';
  const here = isNative ? t('settings.thisDevice') || 'This device' : t('settings.thisBrowser') || 'This browser';
  const lockLabels = kindLabels(kind);

  // Both directions ask for the biometric; a cancelled or failed prompt leaves the switch where it was.
  const toggleLock = async (next: boolean) => {
    try {
      await (next ? enableLock() : disableLock());
    } catch (error) {
      console.error('App lock toggle error:', error);
    }
  };

  // Every sign-out forgets the device on the server: otherwise "Continue" on the sign-in form would
  // sign straight back in, for anyone who knows the address, on a shared device.
  const leave = () => {
    if (isClearing) return;
    showAlert(
      t('settings.signOutDevice') || 'Sign out of this device',
      t('settings.signOutConfirm', { here }) ||
        `${here} will be removed from your account. Signing in again takes an emailed link. Continue?`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('settings.signOutDevice') || 'Sign out of this device',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              clearTrack();
              await forgetDevice();
              router.replace('/(tabs)/(groups)');
            } catch (error) {
              console.error('Sign out error:', error);
              showAlert(
                t('settings.signOutError') || 'Sign Out Error',
                `${t('settings.signOutFailed') || 'Failed to sign out'}: ${storageErrorMessage(error)}. You may need to restart the app.`,
              );
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Rows>
      {isNative ? (
        <SwitchRow
          testID="settings-app-lock"
          icon={kind === 'faceId' ? 'scan' : 'finger-print'}
          title={t(lockLabels.titleKey) || lockLabels.titleFallback}
          subtitle={
            kind
              ? t('appLock.subtitle') || 'Asks for it when you open the app and after 5 minutes away.'
              : t('appLock.unavailable') || 'Set up Face ID or a passcode on this device first.'
          }
          value={lockEnabled}
          onValueChange={toggleLock}
          disabled={!kind && !lockEnabled}
        />
      ) : null}
      <SettingsRow
        testID="settings-sign-out"
        icon="log-out-outline"
        danger
        title={t('settings.signOutDevice') || 'Sign out of this device'}
        subtitle={t('settings.signOutDeviceHint') || 'The next sign-in asks for a link sent to your email.'}
        onPress={leave}
        disabled={isClearing}
      />
    </Rows>
  );
}

/** Contact, legal pages and the version. The membership terms only exist on the web. */
export function AboutSection() {
  const { t } = useLanguage();
  return (
    <Rows>
      <SettingsRow
        icon="mail-outline"
        title={t('settings.contact') || 'Contact the Association'}
        value="info@padmakara.pt"
        onPress={() => Linking.openURL('mailto:info@padmakara.pt')}
      />
      <SettingsRow
        icon="shield-checkmark-outline"
        title={t('privacy.title') || 'Privacy Policy'}
        onPress={() => router.push('/privacy-policy' as any)}
      />
      {Platform.OS === 'web' ? (
        <SettingsRow
          testID="settings-membership-terms"
          icon="document-text-outline"
          title={tr(t, 'termsTitle', 'Membership terms')}
          onPress={() => router.push('/membership/terms' as any)}
        />
      ) : null}
      <SettingsRow icon="information-circle-outline" title={t('profile.version') || 'Version'} value="1.0.0 (Beta)" />
    </Rows>
  );
}
