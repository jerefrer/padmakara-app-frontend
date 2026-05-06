import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import retreatService from '@/services/retreatService';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslatedName } from '@/utils/i18n';
import { colors } from '@/constants/colors';
import type { Gathering } from '@/types';

/**
 * Formats an event's start date for the sidebar — short and locale-aware,
 * e.g. "April 22, 2025" / "22 de abril de 2025".
 */
function formatEventDate(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Inspects the gathering payload to decide which content-type chips to
 * show. Audio is implied by any session having tracks, video by a
 * bunnyVideoId on a session, transcript by a non-empty transcripts array.
 */
function deriveContentFlags(ev: Gathering): {
  hasAudio: boolean;
  hasVideo: boolean;
  hasTranscript: boolean;
} {
  const sessions = ev.sessions || [];
  return {
    hasAudio: sessions.some((s) => s.tracks && s.tracks.length > 0),
    hasVideo: sessions.some((s) => !!s.bunnyVideoId),
    hasTranscript: (ev.transcripts?.length ?? 0) > 0,
  };
}

interface RelatedEventsListProps {
  /** ID of the event currently being viewed (highlighted in the list). */
  currentEventId: string;
  /** Pulled from the current event's principal teacher when available. */
  teacherAbbreviation?: string | null;
  /** Pulled from the current event's parent group when available. */
  groupId?: string | null;
  /** Cosmetic header — defaults to the teacher or group name. */
  headerTitle?: string;
  /** Subtitle line under the header (e.g. "12 Teachings & Talks"). */
  headerSubtitle?: string;
}

// Module-level cache so navigating between sibling events does not
// re-fetch the list (and does not flash empty while the new screen
// mounts). Keyed by `teacher:<abbrev>` or `group:<id>`.
const eventsCache = new Map<string, Gathering[]>();
const cacheKeyFor = (
  teacherAbbreviation?: string | null,
  groupId?: string | null,
): string | null => {
  if (teacherAbbreviation) return `teacher:${teacherAbbreviation}`;
  if (groupId) return `group:${groupId}`;
  return null;
};

/**
 * Sidebar list of all events that share the current event's teacher or
 * parent group. Tap one to navigate to its detail screen — keeping the
 * desktop master/detail mental model intact.
 *
 * Data source priority:
 *   1. If a teacher abbreviation is given, fetch the public events list
 *      and filter by it. (Public events cover most teacher cases.)
 *   2. Else if a groupId is given, fetch /api/groups/:id/events.
 *   3. Otherwise show nothing.
 */
export function RelatedEventsList({
  currentEventId,
  teacherAbbreviation,
  groupId,
  headerTitle,
  headerSubtitle,
}: RelatedEventsListProps) {
  const { t, language } = useLanguage();
  const cacheKey = cacheKeyFor(teacherAbbreviation, groupId);
  const cached = cacheKey ? eventsCache.get(cacheKey) : undefined;
  const [events, setEvents] = useState<Gathering[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;
    const key = cacheKeyFor(teacherAbbreviation, groupId);
    const hit = key ? eventsCache.get(key) : undefined;
    if (hit) {
      setEvents(hit);
      setLoading(false);
      return; // Skip refetch — module cache is the source of truth.
    }
    setLoading(true);

    (async () => {
      try {
        if (teacherAbbreviation) {
          const res = await retreatService.getPublicEvents();
          if (cancelled) return;
          if (res.success && res.data) {
            const filtered = (res.data as Gathering[]).filter((ev) =>
              ev.teachers?.some((te: any) => te.abbreviation === teacherAbbreviation),
            );
            if (key) eventsCache.set(key, filtered);
            setEvents(filtered);
          }
        } else if (groupId) {
          const res = await retreatService.getRetreatGroupDetails(groupId);
          if (cancelled) return;
          if (res.success && res.data) {
            const list = res.data.gatherings || [];
            if (key) eventsCache.set(key, list);
            setEvents(list);
          }
        }
      } catch (err) {
        console.error('RelatedEventsList load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teacherAbbreviation, groupId]);

  const onPick = (eventId: string) => {
    if (String(eventId) === String(currentEventId)) return;
    // Teacher-driven lists mark navigation as the "events" flow so the
    // left nav keeps Teachings & Talks active. Group-driven lists leave
    // it unset so the Retreats item stays active.
    if (teacherAbbreviation) {
      router.push({
        pathname: '/(tabs)/(groups)/retreat/[id]',
        params: { id: String(eventId), from: 'events' },
      } as any);
    } else {
      router.push(`/(tabs)/(groups)/retreat/${eventId}` as any);
    }
  };

  return (
    <View style={styles.container}>
      {(headerTitle || headerSubtitle) && (
        <View style={styles.header}>
          {!!headerTitle && (
            <Text style={styles.headerTitle} numberOfLines={2}>
              {headerTitle}
            </Text>
          )}
          {!!headerSubtitle && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          )}
        </View>
      )}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.burgundy[500]} />
          </View>
        ) : events.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('events.empty') || 'No events available'}
          </Text>
        ) : (
          events.map((ev) => {
            const isActive = String(ev.id) === String(currentEventId);
            const title = getTranslatedName(ev as any, language as 'en' | 'pt') || ev.name;
            const dateText = formatEventDate(ev.startDate, language);
            const { hasAudio, hasVideo, hasTranscript } = deriveContentFlags(ev);
            const iconColor = isActive ? colors.burgundy[500] : colors.gray[400];
            return (
              <Pressable
                key={ev.id}
                style={[styles.item, isActive && styles.itemActive]}
                onPress={() => onPick(ev.id)}
              >
                <Text
                  style={[styles.itemTitle, isActive && styles.itemTitleActive]}
                  numberOfLines={3}
                >
                  {title}
                </Text>
                <View style={styles.itemMeta}>
                  {!!dateText && (
                    <Text style={[styles.itemDate, isActive && styles.itemDateActive]}>
                      {dateText}
                    </Text>
                  )}
                  {(hasAudio || hasVideo || hasTranscript) && (
                    <View style={styles.itemIcons}>
                      {hasAudio && (
                        <Ionicons
                          name="musical-notes-outline"
                          size={12}
                          color={iconColor}
                        />
                      )}
                      {hasVideo && (
                        <Ionicons
                          name="videocam-outline"
                          size={12}
                          color={iconColor}
                        />
                      )}
                      {hasTranscript && (
                        <Ionicons
                          name="book-outline"
                          size={12}
                          color={iconColor}
                        />
                      )}
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.gray[200],
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.burgundy[500],
  },
  headerTitle: {
    fontFamily: 'MinionPro_Bold',
    fontSize: 22,
    fontVariant: ['small-caps'] as any,
    color: colors.burgundy[500],
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    // Transparent left border on inactive items so the layout doesn't
    // shift when an item becomes active and gains a 3px burgundy bar.
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  itemActive: {
    backgroundColor: colors.burgundy[50],
    borderLeftColor: colors.burgundy[500],
    paddingLeft: 21, // 24 - 3 to keep text horizontally aligned
  },
  itemTitle: {
    fontFamily: 'EBGaramond_500Medium',
    fontSize: 16,
    color: colors.gray[800],
    lineHeight: 22,
  },
  itemTitleActive: {
    color: colors.burgundy[500],
    fontFamily: 'EBGaramond_700Bold',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemDate: {
    fontSize: 12,
    color: colors.gray[500],
  },
  itemDateActive: {
    color: colors.burgundy[500],
  },
  itemIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  loading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    color: colors.gray[500],
    fontSize: 14,
  },
});
