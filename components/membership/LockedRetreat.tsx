import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateRange } from '@/utils/dateFormat';
import type { EventPreview } from '@/types';
import { membershipColors as c, fonts } from './theme';
import { tr } from './tr';

interface Props {
  reason: 'auth' | 'membership' | 'other';
  preview: EventPreview | null;
}

/**
 * Shown in place of a retreat the viewer cannot open. Web leads to /membership;
 * native (reader app) states the fact and never shows a price, a join button or a website link.
 */
export function LockedRetreat({ reason, preview }: Props) {
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const isWeb = Platform.OS === 'web';
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';

  const title = preview ? ((lang === 'pt' ? preview.titlePt || preview.titleEn : preview.titleEn || preview.titlePt) ?? '') : '';
  const teachers = preview?.teachers.map((x) => x.name).filter(Boolean).join(', ') ?? '';
  const dates = preview?.startDate ? formatDateRange(preview.startDate, preview.endDate ?? undefined, lang) : '';
  const meta = [teachers, dates].filter(Boolean);

  const signIn = () =>
    router.push({
      pathname: '/(auth)/magic-link',
      params: { returnTo: preview ? `/(tabs)/(groups)/retreat/${preview.id}` : '/(tabs)/(groups)' },
    } as any);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {preview?.imageUrl ? (
        <Image source={{ uri: preview.imageUrl }} style={styles.hero} contentFit="cover" />
      ) : null}
      {title ? (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {meta.map((line) => (
        <Text key={line} style={styles.meta}>
          {line}
        </Text>
      ))}

      {reason === 'other' ? (
        <View style={styles.lock}>
          <Text style={styles.body}>
            {tr(t, 'lockedOther', 'This retreat is available to its participants.')}
          </Text>
        </View>
      ) : isWeb ? (
        <View style={styles.lock}>
          <Text style={styles.lockTitle}>{tr(t, 'lockedWebTitle', 'Recordings for members')}</Text>
          <Text style={styles.body}>
            {tr(
              t,
              'lockedWebBody',
              'Members of the Padmakara community can listen to every retreat they are part of, and read the transcripts.',
            )}
          </Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push('/membership' as any)}>
            <Text style={styles.buttonText}>{tr(t, 'lockedCta', 'Become a member · from €5/month')}</Text>
          </Pressable>
          {!isAuthenticated && (
            <Pressable accessibilityRole="link" onPress={signIn}>
              <Text style={styles.link}>{tr(t, 'lockedSignInLink', 'Already a member? Sign in')}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.lock}>
          <Text style={styles.lockTitle}>{tr(t, 'lockedNativeTitle', 'Available to members')}</Text>
          <Text style={styles.body}>
            {tr(
              t,
              'lockedNativeBody',
              'Once your account has access, these recordings appear here automatically.',
            )}
          </Text>
          {!isAuthenticated && (
            <Pressable accessibilityRole="button" style={styles.ghost} onPress={signIn}>
              <Text style={styles.ghostText}>{tr(t, 'signIn', 'Sign in')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24, gap: 10 },
  hero: { width: '100%', height: 180, borderRadius: 12, backgroundColor: c.gray[100] },
  title: { fontSize: 28, fontFamily: fonts.display, fontWeight: '600', color: c.burgundy[500], marginTop: 6 },
  meta: { fontSize: 15, color: c.gray[600] },
  lock: {
    marginTop: 12,
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.gray[200],
    backgroundColor: c.burgundy[50],
  },
  lockTitle: { fontSize: 16, fontWeight: '600', color: c.gray[800] },
  body: { fontSize: 15, lineHeight: 22, color: c.gray[800] },
  button: { backgroundColor: c.burgundy[500], borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: c.white, fontSize: 15, fontWeight: '600' },
  ghost: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.burgundy[500],
    backgroundColor: c.white,
  },
  ghostText: { color: c.burgundy[500], fontSize: 15, fontWeight: '600' },
  link: { color: c.burgundy[500], fontSize: 15, textAlign: 'center', textDecorationLine: 'underline' },
});
