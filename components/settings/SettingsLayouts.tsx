import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFocusRing } from '@/components/membership/focusRing';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c, fonts } from '@/components/membership/theme';
import { SectionBody, SECTIONS_WITH_OWN_TITLE } from './SectionBody';
import type { SectionId } from './sections';
import { GroupLabel, Rows, SectionTitle, SettingsRow } from './ui';
import { useSettingsIndex } from './useSettingsIndex';

function initials(name: string | undefined, email: string | undefined): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email || '?')[0].toUpperCase();
}

/** Who is signed in, or an invitation to sign in. */
function Identity({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) {
    return (
      <View testID="settings-sign-in" style={[styles.identity, styles.signInCard]}>
        <Text style={styles.signInText}>
          {t('groups.signInPrompt') || 'Access recordings and transcripts from your retreat group’s gatherings.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [pageStyles.button, pressed && pageStyles.buttonPressed]}
          onPress={() => router.push({ pathname: '/(auth)/magic-link', params: { returnTo: '/(tabs)/settings' } } as any)}
        >
          <Text style={pageStyles.buttonText}>{t('groups.signIn') || 'Sign In'}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View testID="settings-identity" style={[styles.identity, !compact && styles.identityCard]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(user.name, user.email)}</Text>
      </View>
      <View style={styles.identityText}>
        <Text style={styles.identityName} numberOfLines={1}>{user.name || user.email}</Text>
        {user.name ? <Text style={styles.identityEmail} numberOfLines={1}>{user.email}</Text> : null}
      </View>
    </View>
  );
}

/** Phone and narrow windows: the index as a list; each row opens the section on its own page. */
export function SettingsList() {
  const { t } = useLanguage();
  const groups = useSettingsIndex();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.listContent}>
      <View style={pageStyles.container}>
        <Text style={pageStyles.title} accessibilityRole="header">{t('navigation.settings') || 'Settings'}</Text>
        <View style={styles.identityGap}>
          <Identity />
        </View>
        {groups.map((g) => (
          <View key={g.group}>
            <GroupLabel hint={g.hint}>{g.label}</GroupLabel>
            <Rows>
              {g.items.map((s) => (
                <SettingsRow
                  key={s.id}
                  testID={`settings-row-${s.id}`}
                  icon={s.icon}
                  title={s.label}
                  value={s.value}
                  // The membership already has its own page, with its own back control.
                  onPress={() => router.push((s.id === 'membership' ? '/membership' : `/(tabs)/settings/${s.id}`) as any)}
                />
              ))}
            </Rows>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function NavItem({ id, icon, label, selected, onSelect }: {
  id: SectionId;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  selected: boolean;
  onSelect: (id: SectionId) => void;
}) {
  const ring = useFocusRing();
  return (
    <Pressable
      testID={`settings-nav-${id}`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={() => onSelect(id)}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={({ pressed, hovered }: any) => [
        styles.navItem,
        (hovered || pressed) && !selected && styles.navItemHover,
        selected && styles.navItemOn,
        ring.style,
      ]}
    >
      <Ionicons name={icon} size={20} color={selected ? c.burgundy[500] : c.gray[600]} />
      <Text style={[styles.navText, selected && styles.navTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Wide desktop: the index stays on the left, the chosen section fills the rest. */
export function SettingsTwoPane({ selected, onSelect }: { selected: SectionId; onSelect: (id: SectionId) => void }) {
  const groups = useSettingsIndex();
  const current = groups.flatMap((g) => g.items).find((s) => s.id === selected);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.twoPane}>
      <View style={styles.nav} accessibilityRole="tablist">
        <Identity compact />
        {groups.map((g) => (
          <View key={g.group}>
            <Text style={styles.navGroup}>{g.label}</Text>
            {g.items.map((s) => (
              <NavItem key={s.id} id={s.id} icon={s.icon} label={s.label} selected={s.id === selected} onSelect={onSelect} />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.pane} testID={`settings-pane-${selected}`}>
        {SECTIONS_WITH_OWN_TITLE.has(selected) ? (
          <SectionBody id={selected} />
        ) : (
          <View style={pageStyles.container}>
            <View style={styles.paneTitle}>
              <SectionTitle>{current?.label ?? ''}</SectionTitle>
            </View>
            <SectionBody id={selected} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream[100] },
  listContent: { paddingBottom: 100 },
  identityGap: { marginTop: 20 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityCard: { padding: 16, backgroundColor: c.cream[200], borderWidth: 1, borderColor: c.gray[200] },
  signInCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: c.cream[200],
    borderWidth: 1,
    borderColor: c.gray[200],
  },
  signInText: { fontSize: 16, lineHeight: 22, color: c.gray[700] },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.burgundy[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 19, color: c.burgundy[500], fontFamily: fonts.display },
  identityText: { flex: 1, minWidth: 0 },
  identityName: { fontSize: 17, fontWeight: '600', color: c.gray[800], fontFamily: fonts.display },
  identityEmail: { fontSize: 14, color: c.gray[500], marginTop: 2 },
  twoPane: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 42, paddingHorizontal: 32, paddingBottom: 100, gap: 32 },
  nav: { width: 260, flexShrink: 0, gap: 2 },
  navGroup: {
    fontSize: 12,
    fontWeight: '600',
    color: c.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 28,
    marginBottom: 6,
    paddingHorizontal: 14,
  },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 14, borderRadius: 2 },
  navItemHover: { backgroundColor: c.gray[100] },
  navItemOn: { backgroundColor: c.burgundy[50] },
  navText: { fontSize: 15, color: c.gray[700] },
  navTextOn: { color: c.burgundy[500], fontWeight: '600' },
  pane: { flex: 1, minWidth: 0, maxWidth: 680 },
  // Same top margin as the membership page titles, so every pane's title sits on one line.
  paneTitle: { marginTop: 24 },
});
