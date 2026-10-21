import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import retreatService from '@/services/retreatService';
import { getTranslatedName } from '@/utils/i18n';
import { tr } from '@/components/membership/tr';
import { membershipColors as c } from '@/components/membership/theme';
import type { RetreatGroup } from '@/types';
import { ContentLanguageRows } from './DeviceSections';
import { GroupLabel, Rows, Segmented, SettingsRow } from './ui';

/** Who the person is, and the way out of the account. */
export function ProfileSection() {
  const { t } = useLanguage();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Rows>
        <SettingsRow testID="settings-profile-name" icon="person-outline" title={t('settings.name') || 'Name'} value={user.name || '—'} />
        {user.dharma_name ? (
          <SettingsRow icon="flower-outline" title={t('settings.dharmaName') || 'Dharma name'} value={user.dharma_name} />
        ) : null}
        <SettingsRow
          icon="mail-outline"
          title={t('settings.email') || 'Email'}
          subtitle={t('settings.emailHint') || 'You sign in with a link sent to this address.'}
          value={user.email}
        />
      </Rows>
      <GroupLabel>{t('settings.leaving') || 'Close your account'}</GroupLabel>
      <Rows>
        <SettingsRow
          testID="settings-delete-account"
          icon="trash-outline"
          danger
          title={t('deleteAccount.title') || 'Delete Account'}
          subtitle={t('settings.deleteAccountHint') || 'Removes your account, progress and bookmarks.'}
          onPress={() => router.push('/delete-account' as any)}
        />
      </Rows>
    </>
  );
}

/** The interface language. Saved on the account when signed in, so it follows the person. */
export function LanguageSection() {
  const { t, language, setLanguage } = useLanguage();
  const { user, isAuthenticated, updateUser } = useAuth();

  const choose = async (next: 'en' | 'pt') => {
    if (isAuthenticated && user) {
      await updateUser({ preferences: { ...(user.preferences || {}), language: next } });
    }
    await setLanguage(next);
  };

  return (
    <>
      <Rows>
        <SettingsRow
          icon="language-outline"
          title={t('profile.language') || 'App Language'}
          subtitle={t('settings.languageHint') || 'Menus, buttons and emails.'}
          right={
            <Segmented
              label={t('profile.language') || 'App Language'}
              value={language === 'pt' ? 'pt' : 'en'}
              onChange={choose}
              options={[
                { value: 'en', label: 'English' },
                { value: 'pt', label: 'Português' },
              ]}
            />
          }
        />
      </Rows>
      {/* The languages of what is played: kept on this device, but looked for here with the
          app language. */}
      <GroupLabel>{t('settings.contentLanguages') || 'Recordings and videos'}</GroupLabel>
      <ContentLanguageRows />
    </>
  );
}

/**
 * What the person can open: the access state and the retreat groups open to them. Shown on every platform,
 * without a price or a way to pay, so it stays within the reader-app rule.
 */
export function RetreatsSection() {
  const { t, language } = useLanguage();
  const { hasActiveSubscription } = useAuth();
  const [groups, setGroups] = useState<RetreatGroup[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    retreatService
      .getUserRetreats()
      .then((res) => !cancelled && setGroups(res.success && res.data ? res.data.retreat_groups : []))
      .catch(() => !cancelled && setGroups([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const count = (n: number) =>
    `${n} ${n === 1 ? t('groups.retreatLabel') || 'retreat' : t('groups.retreatsLabel') || 'retreats'}`;

  return (
    <>
      <Rows>
        <SettingsRow
          testID="settings-access"
          icon={hasActiveSubscription ? 'checkmark-circle-outline' : 'information-circle-outline'}
          title={tr(t, 'accessLabel', 'Access')}
          value={hasActiveSubscription ? tr(t, 'fullAccess', 'Full access') : tr(t, 'publicOnly', 'Public content only')}
        />
      </Rows>
      {/* /groups lists the groups holding events this person can open, not their memberships. Read-only: a
          row that jumped to the Retreats tab flashed the home screen on the way. */}
      <GroupLabel>{t('settings.openGroups') || 'Open to you'}</GroupLabel>
      {groups === null ? null : groups.length === 0 ? (
        <Text style={styles.empty}>{t('settings.noGroups') || 'No retreat recordings are open to you yet.'}</Text>
      ) : (
        <Rows>
          {groups.map((g) => (
            <SettingsRow
              key={g.id}
              testID={`settings-group-${g.id}`}
              title={getTranslatedName(g, language === 'pt' ? 'pt' : 'en')}
              value={count(g.gatherings?.length ?? 0)}
            />
          ))}
        </Rows>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 15, color: c.gray[600], lineHeight: 22 },
});
