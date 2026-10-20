import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipStatusLine } from '@/components/membership/statusLine';
import { tr } from '@/components/membership/tr';
import { visibleSections, type SectionDef, type SectionGroup } from './sections';

export interface IndexGroup {
  group: SectionGroup;
  label: string;
  hint?: string;
  items: (SectionDef & { label: string; value?: string })[];
}

/** The sections visible here, grouped and labelled, each with the one-line state shown beside it. */
export function useSettingsIndex(): IndexGroup[] {
  const { t, language } = useLanguage();
  const { isAuthenticated, hasActiveSubscription, user } = useAuth();
  const isWeb = Platform.OS === 'web';
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';

  const values: Partial<Record<SectionDef['id'], string>> = {
    language: lang === 'pt' ? 'Português' : 'English',
    // Without a membership the row's label ("Become a member") already says it all.
    membership: hasActiveSubscription
      ? membershipStatusLine(t, lang, hasActiveSubscription, user?.subscription)
      : undefined,
    retreats: hasActiveSubscription ? tr(t, 'fullAccess', 'Full access') : tr(t, 'publicOnly', 'Public content only'),
  };

  const labels: Record<SectionGroup, { label: string; hint?: string }> = {
    account: isAuthenticated
      ? { label: t('settings.groupAccount') || 'Your account', hint: t('settings.groupAccountHint') || 'The same on all your devices.' }
      : { label: t('settings.groupPreferences') || 'Preferences' },
    device: {
      label: isWeb ? t('settings.thisBrowser') || 'This browser' : t('settings.thisDevice') || 'This device',
      hint: t('settings.groupDeviceHint') || 'Only here. Your other devices keep their own.',
    },
    help: { label: t('settings.groupHelp') || 'Help' },
  };

  const groups: IndexGroup[] = [];
  for (const s of visibleSections({ isWeb, isAuthenticated })) {
    let g = groups.find((x) => x.group === s.group);
    if (!g) {
      g = { group: s.group, ...labels[s.group], items: [] };
      groups.push(g);
    }
    // Without a membership the row invites to join, as the old Settings row did.
    const label =
      s.id === 'membership'
        ? hasActiveSubscription
          ? tr(t, 'settingsRow', 'Membership')
          : tr(t, 'title', 'Become a member')
        : t(s.labelKey) || s.fallback;
    g.items.push({ ...s, label, value: values[s.id] });
  }
  return groups;
}
