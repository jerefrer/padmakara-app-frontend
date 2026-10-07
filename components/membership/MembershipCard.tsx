import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLongDate } from '@/utils/dateFormat';
import { membershipColors as c, fonts } from './theme';
import { tr } from './tr';

interface Props {
  /** `status` for Settings (state + manage/join link); `invite` for the home screen (join only). */
  variant: 'status' | 'invite';
}

/** Web-only entry point to /membership. Native uses ReaderAccountStatus instead (no price, no link). */
export function MembershipCard({ variant }: Props) {
  const { t, language } = useLanguage();
  const { user, hasActiveSubscription } = useAuth();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';
  const open = () => router.push('/membership' as any);

  if (variant === 'invite') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{tr(t, 'title', 'Become a member')}</Text>
        <Text style={styles.body}>
          {tr(t, 'homeCardBody', 'Your contribution keeps the teachings available to everyone.')}
        </Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={open}>
          <Text style={styles.buttonText}>{tr(t, 'title', 'Become a member')}</Text>
        </Pressable>
      </View>
    );
  }

  const sub = user?.subscription;
  // Only a membership paid through Easypay can be managed here; an admin grant, cash or bank
  // transfer has nothing to change, so those members are pointed to us instead.
  const managedByUs = hasActiveSubscription && sub?.source !== 'easypay';
  const endsOn = sub?.cancelledAt && sub.expiresAt ? sub.expiresAt : null;
  const statusLine = !hasActiveSubscription
    ? tr(t, 'statusNone', 'No active membership')
    : endsOn
      ? tr(t, 'statusEnds', 'Ends {{date}}', { date: formatLongDate(endsOn, lang) })
      : tr(t, 'statusActive', 'Active');

  return (
    <View style={styles.card}>
      <Text style={[styles.status, hasActiveSubscription ? styles.ok : styles.neutral]}>{statusLine}</Text>
      {managedByUs ? (
        <Text style={styles.body}>{tr(t, 'contactUs', 'Contact us to change your membership')}</Text>
      ) : (
        <Pressable accessibilityRole="button" style={styles.button} onPress={open}>
          <Text style={styles.buttonText}>
            {hasActiveSubscription ? tr(t, 'manageCta', 'Manage membership') : tr(t, 'title', 'Become a member')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.gray[200],
    backgroundColor: c.burgundy[50],
  },
  title: { fontSize: 20, fontFamily: fonts.display, fontWeight: '600', color: c.burgundy[500] },
  body: { fontSize: 15, lineHeight: 22, color: c.gray[700] },
  status: { fontSize: 16, fontWeight: '600' },
  ok: { color: c.green[700] },
  neutral: { color: c.gray[600] },
  button: { backgroundColor: c.burgundy[500], borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: c.white, fontSize: 15, fontWeight: '600' },
});
