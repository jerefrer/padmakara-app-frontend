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

const HERO_HEIGHT = 300;
const HERO_COLLAPSE_END = 250;

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

      {/* Back button (overlaid on hero) */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color={colors.white} />
      </TouchableOpacity>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Collapsible hero */}
        {hasHero && (
          <Animated.View style={[styles.heroContainer, heroStyle]}>
            <Image
              source={{ uri: teacher.heroUrl! }}
              cacheKey={
                teacher.heroUpdatedAt
                  ? `teacher-hero-${teacher.abbreviation}-${teacher.heroUpdatedAt}`
                  : undefined
              }
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
          </Animated.View>
        )}

        {/* Teacher info */}
        <View style={[styles.infoSection, !hasHero && { paddingTop: insets.top + 48 }]}>
          <Text style={styles.teacherName}>{teacher.name}</Text>
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

            return (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => router.push(`/(tabs)/(groups)/retreat/${event.id}` as any)}
              >
                <Text style={styles.eventTitle}>{eventTitle}</Text>
                <Text style={styles.eventMeta}>
                  {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
                  {event.startDate ? `  ·  ${new Date(event.startDate).getFullYear()}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.ScrollView>
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
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.gray200,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  teacherName: {
    fontFamily: 'EBGaramond_600SemiBold',
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
  eventMeta: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 4,
  },
});
