import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/contexts/LanguageContext';
import retreatService from '@/services/retreatService';
import type { Gathering, GatheringTeacher } from '@/types';
import { teacherHeroCacheKey } from '@/utils/cacheKeys';

const HERO_HEIGHT = 380;
const HERO_COLLAPSE_END = 320;

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'En',
  pt: 'Pt',
  tib: 'Tib',
  bo: 'Tib',
};

/** Compute total track duration (seconds) across an event's sessions. */
function eventDurationSeconds(event: Gathering): number {
  let total = 0;
  for (const s of event.sessions || []) {
    for (const t of s.tracks || []) {
      total += t.duration || 0;
    }
  }
  return total;
}

/** Format duration as "208min" (matching the design). */
function formatMinutes(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '';
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes}min`;
}

/** Collect distinct languages across the event's tracks, in display order. */
function eventLanguages(event: Gathering): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of event.sessions || []) {
    for (const t of s.tracks || []) {
      const langs = t.languages?.length ? t.languages : t.originalLanguage ? [t.originalLanguage] : [];
      for (const raw of langs) {
        const key = raw?.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(LANGUAGE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1));
      }
    }
  }
  return out;
}

/** Has at least one session with an attached video recording? */
function eventHasVideo(event: Gathering): boolean {
  return !!event.sessions?.some((s) => !!s.bunnyVideoId);
}

/** Has at least one event-level transcript? */
function eventHasTranscript(event: Gathering): boolean {
  return !!event.transcripts && event.transcripts.length > 0;
}

/** Format ISO date as "YYYY-MM-DD". */
function formatIsoDate(dateStr: string): string {
  if (!dateStr) return '';
  // Already YYYY-MM-DD or full ISO — slice off the time if present.
  return dateStr.length >= 10 ? dateStr.slice(0, 10) : dateStr;
}

const colors = {
  burgundy500: '#9b1b1b',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray800: '#2c2c2c',
  white: '#ffffff',
};

export default function TeacherDetailScreen() {
  const { abbreviation } = useLocalSearchParams<{ abbreviation: string }>();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<GatheringTeacher | null>(null);
  const [events, setEvents] = useState<Gathering[]>([]);

  useEffect(() => {
    loadTeacherEvents();
  }, [abbreviation]);

  async function loadTeacherEvents() {
    setLoading(true);
    try {
      const res = await retreatService.getPublicEvents();
      if (res.success && res.data) {
        const allEvents = res.data;
        const teacherEvents = allEvents.filter((ev: any) =>
          ev.teachers?.some((t: any) => t.abbreviation === abbreviation)
        );
        if (teacherEvents.length > 0) {
          const found = teacherEvents[0].teachers?.find((t: any) => t.abbreviation === abbreviation) || null;
          setTeacher(found);
        }
        setEvents(teacherEvents);
      }
    } catch (err) {
      console.error('Failed to load teacher events:', err);
    } finally {
      setLoading(false);
    }
  }

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const heroStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_END],
      [HERO_HEIGHT, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_END * 0.4, HERO_COLLAPSE_END],
      [1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const hasHero = !!teacher?.heroUrl;

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.burgundy500} />
      </View>
    );
  }

  if (!teacher) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{t('common.error') || 'Teacher not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Collapsible hero — extends to the very top of the screen, behind
            the status bar. Plain 'cover' rendering with the focal point set
            in the admin; the admin crop dialog shows a "mobile safe zone"
            overlay so the editor knows which part of the banner will be
            cropped on mobile. */}
        {hasHero && (
          <Animated.View style={[styles.heroContainer, heroStyle]}>
            <Image
              source={{ uri: teacher.heroUrl! }}
              cacheKey={teacherHeroCacheKey(teacher)}
              cachePolicy="memory-disk"
              transition={0}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              contentPosition={{
                left: `${teacher.heroFocalX ?? 50}%`,
                top: `${teacher.heroFocalY ?? 50}%`,
              }}
            />
          </Animated.View>
        )}

        {/* Teacher name (back button moved to a floating button over the
            hero — see below) */}
        <View style={styles.headerRow}>
          <Text style={styles.teacherName}>{teacher.name}</Text>
        </View>
        <View style={styles.infoSection}>
          <Text style={styles.eventCount}>
            {events.length} {events.length === 1
              ? (t('events.teaching') || 'Teaching')
              : (t('events.teachings') || 'Teachings & talks')}
          </Text>
        </View>

        {/* Event list */}
        <View style={styles.eventList}>
          {events.map((event) => {
            const eventTitle = (language === 'pt' && event.name_translations?.pt)
              ? event.name_translations.pt
              : event.name;
            const sessionCount = event.sessions?.length || 0;
            const durationLabel = formatMinutes(eventDurationSeconds(event));
            const langs = eventLanguages(event).join(' + ');
            const dateLabel = formatIsoDate(event.startDate);
            const placeLabel = event.places?.map((p) => p.name).filter(Boolean).join(', ') || '';
            const orgLabel = event.retreatGroups
              ?.map((g) => g.abbreviation || g.name)
              .filter(Boolean)
              .join(' & ') || '';

            const hasVideo = eventHasVideo(event);
            const hasTranscript = eventHasTranscript(event);

            const statsParts = [
              `${sessionCount} ${sessionCount === 1
                ? (t('events.sessionLabel') || 'session')
                : (t('events.sessionsLabel') || 'sessions')}`,
              durationLabel,
              langs,
            ].filter(Boolean);

            const metaParts = [
              dateLabel,
              placeLabel,
              orgLabel ? `${t('events.organizerPrefix') || 'Org.'} ${orgLabel}` : '',
            ].filter(Boolean);

            return (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => router.push({ pathname: '/(tabs)/(groups)/retreat/[id]', params: { id: String(event.id), from: 'events' } } as any)}
              >
                <Text style={styles.eventTitle}>{eventTitle}</Text>
                {statsParts.length > 0 && (
                  <Text style={styles.eventStats}>{statsParts.join('  ')}</Text>
                )}
                {metaParts.length > 0 && (
                  <Text style={styles.eventMeta}>{metaParts.join('  |  ')}</Text>
                )}
                <View style={styles.eventIconRow}>
                  <View style={styles.eventIconGroup}>
                    {hasVideo && (
                      <Ionicons name="videocam-outline" size={18} color={colors.gray600} style={styles.eventIcon} />
                    )}
                    {sessionCount > 0 && (
                      <Ionicons name="musical-notes-outline" size={18} color={colors.gray600} style={styles.eventIcon} />
                    )}
                    {hasTranscript && (
                      <Ionicons name="book-outline" size={18} color={colors.gray600} style={styles.eventIcon} />
                    )}
                  </View>
                  {/* Visual placeholder — event-level bookmark not wired to a
                      backend yet. Tap is a no-op until the feature lands. */}
                  <View style={styles.eventBookmarkButton}>
                    <Ionicons name="bookmark-outline" size={20} color={colors.burgundy500} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.ScrollView>

      {/* Floating back button over the hero — sits inside the safe area
          (insets.top) so it stays clear of the notch / status bar. */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.floatingBackButton, { top: insets.top + 8 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={22} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  errorText: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 16,
    color: colors.gray500,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  floatingBackButton: {
    position: 'absolute',
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  heroContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.gray200,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  teacherName: {
    flex: 1,
    fontFamily: 'MinionPro',
    fontSize: 28,
    fontVariant: ['small-caps'],
    color: colors.burgundy500,
  },
  eventCount: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 15,
    color: colors.gray600,
    marginTop: 2,
  },
  eventList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  eventCard: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  eventTitle: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 18,
    color: colors.gray800,
  },
  eventStats: {
    fontSize: 14,
    color: colors.gray800,
    marginTop: 4,
  },
  eventMeta: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 2,
  },
  eventIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  eventIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    marginRight: 14,
  },
  eventBookmarkButton: {
    padding: 4,
  },
});
