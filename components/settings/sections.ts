import type { Ionicons } from '@expo/vector-icons';
import type React from 'react';

export type SectionId =
  | 'profile'
  | 'language'
  | 'membership'
  | 'retreats'
  | 'listening'
  | 'storage'
  | 'signin'
  | 'about';

/**
 * Settings are sorted by where they live: the account follows the person to every device,
 * the device group only applies here, help comes last.
 */
export type SectionGroup = 'account' | 'device' | 'help';

export interface SectionDef {
  id: SectionId;
  group: SectionGroup;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  labelKey: string;
  fallback: string;
}

interface Where {
  isWeb: boolean;
  isAuthenticated: boolean;
}

const SECTIONS: (SectionDef & { show: (w: Where) => boolean })[] = [
  { id: 'profile', group: 'account', icon: 'person-outline', labelKey: 'settings.profile', fallback: 'Profile', show: (w) => w.isAuthenticated },
  { id: 'language', group: 'account', icon: 'language-outline', labelKey: 'settings.language', fallback: 'Language', show: () => true },
  // Reader-app rule: the native app never shows the donation, its price or a way to pay.
  { id: 'membership', group: 'account', icon: 'heart-outline', labelKey: 'membership.manageTitle', fallback: 'Membership', show: (w) => w.isWeb && w.isAuthenticated },
  { id: 'retreats', group: 'account', icon: 'layers-outline', labelKey: 'settings.retreats', fallback: 'Your retreats', show: (w) => w.isAuthenticated },
  { id: 'listening', group: 'device', icon: 'headset-outline', labelKey: 'settings.listening', fallback: 'Listening', show: () => true },
  { id: 'storage', group: 'device', icon: 'download-outline', labelKey: 'settings.storage', fallback: 'Offline & storage', show: (w) => w.isAuthenticated },
  { id: 'signin', group: 'device', icon: 'shield-checkmark-outline', labelKey: 'settings.signIn', fallback: 'Sign-in & security', show: (w) => w.isAuthenticated },
  { id: 'about', group: 'help', icon: 'information-circle-outline', labelKey: 'settings.about', fallback: 'About & help', show: () => true },
];

export function visibleSections(where: Where): SectionDef[] {
  return SECTIONS.filter((s) => s.show(where)).map(({ show: _show, ...def }) => def);
}

export function isSectionId(value: unknown): value is SectionId {
  return typeof value === 'string' && SECTIONS.some((s) => s.id === value);
}

/** The section a two-pane layout opens on: the requested one when it is visible here, else the first. */
export function defaultSection(where: Where, requested: unknown): SectionId {
  const visible = visibleSections(where);
  if (isSectionId(requested) && visible.some((s) => s.id === requested)) return requested;
  return visible[0].id;
}
