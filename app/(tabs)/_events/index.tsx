import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Pressable, RefreshControl } from 'react-native';
import { Stack, router, useGlobalSearchParams, useSegments } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import retreatService from '@/services/retreatService';
import { teacherAvatarCacheKey } from '@/utils/cacheKeys';

const colors = {
  burgundy: {
    500: '#9b1b1b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2c2c2c',
  },
  white: '#ffffff',
};

type ViewMode = 'teachers' | 'date';

// ── Teacher row (for "by teacher" view) ─────────────────────────────────────

interface TeacherGroup {
  name: string;
  abbreviation: string;
  photoUrl: string | null;
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | null;
  eventCount: number;
}

function TeacherRow({ teacher, onPress, t }: { teacher: TeacherGroup; onPress: () => void; t: (key: string) => string | undefined }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.teacherRow}>
      <View style={styles.teacherAvatarLarge}>
        {(teacher.avatarUrl || teacher.photoUrl) ? (
          <Image
            source={{ uri: (teacher.avatarUrl || teacher.photoUrl)! }}
            cacheKey={teacherAvatarCacheKey(teacher)}
            cachePolicy="memory-disk"
            transition={0}
            style={styles.teacherAvatarLargeImg}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.teacherAvatarLargeImg, styles.teacherAvatarFallback]}>
            <Text style={styles.teacherAvatarFallbackText}>
              {teacher.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.teacherRowInfo}>
        <Text style={styles.teacherRowName}>{teacher.name}</Text>
        <Text style={styles.teacherRowCount}>
          {teacher.eventCount === 1
            ? `1 ${t('events.teaching') || 'Teaching'}`
            : `${teacher.eventCount} ${t('events.teachings') || 'Teachings'}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Event card (for "by date" view) ─────────────────────────────────────────

function EventCard({ event, onPress, language, testID }: { event: any; onPress: () => void; language: string; testID?: string }) {
  const title = (language === 'pt' && event.name_translations?.pt)
    ? event.name_translations.pt
    : event.name || event.name_translations?.en || '';
  const sessionCount = event.sessions?.length || 0;
  const teacherNames = event.teachers?.map((t: any) => t.name).filter(Boolean).join(', ') || '';

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  const teacherPhoto = event.teachers?.[0]?.avatarUrl || event.teachers?.[0]?.photoUrl || null;

  return (
    <TouchableOpacity onPress={onPress} style={styles.eventCard} testID={testID}>
      <View style={styles.eventCardAvatar}>
        {teacherPhoto ? (
          <Image source={{ uri: teacherPhoto }} style={styles.eventCardAvatarImg} contentFit="cover" />
        ) : (
          <View style={[styles.eventCardAvatarImg, styles.teacherAvatarFallback]}>
            <Ionicons name="musical-notes-outline" size={20} color={colors.gray[400]} />
          </View>
        )}
      </View>
      <View style={styles.eventCardInfo}>
        <Text style={styles.eventCardTitle} numberOfLines={2}>{title}</Text>
        {teacherNames ? (
          <Text style={styles.eventCardTeacher} numberOfLines={1}>{teacherNames}</Text>
        ) : null}
        <Text style={styles.eventCardMeta}>
          {event.startDate ? formatDate(event.startDate) : ''}
          {sessionCount > 0 ? ` · ${sessionCount} sessions` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Desktop event row ────────────────────────────────────────────────────────

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDateRangePretty(startDateStr: string, endDateStr: string, locale: string): string {
  try {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const isPt = locale === 'pt';
    const localeStr = isPt ? 'pt-PT' : 'en-US';
    const startMonth = startDate.toLocaleDateString(localeStr, { month: 'long' });
    const endMonth = endDate.toLocaleDateString(localeStr, { month: 'long' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();

    if (isPt) {
      if (startDay === endDay && startMonth === endMonth) return `${startDay} de ${startMonth}`;
      if (startMonth === endMonth) return `${startDay}–${endDay} de ${startMonth}`;
      return `${startDay} de ${startMonth} – ${endDay} de ${endMonth}`;
    }

    if (startDay === endDay && startMonth === endMonth) return `${startMonth} ${getOrdinal(startDay)}`;
    if (startMonth === endMonth) return `${startMonth} ${getOrdinal(startDay)}–${getOrdinal(endDay)}`;
    return `${startMonth} ${getOrdinal(startDay)} – ${endMonth} ${getOrdinal(endDay)}`;
  } catch {
    return `${startDateStr}`;
  }
}

function TeacherAvatars({ teachers }: { teachers?: any[] }) {
  if (!teachers || teachers.length === 0) return null;
  const shown = teachers.slice(0, 3);
  return (
    <View style={styles.desktopTeacherAvatars}>
      {shown.map((teacher: any, i: number) => (
        <View key={teacher.abbreviation || i} style={[styles.desktopAvatarWrapper, i > 0 && { marginLeft: -8 }]}>
          {(teacher.avatarUrl || teacher.photoUrl) ? (
            <Image source={{ uri: (teacher.avatarUrl || teacher.photoUrl)! }} style={styles.desktopAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.desktopAvatar, styles.teacherAvatarFallback]}>
              <Text style={styles.desktopAvatarFallbackText}>
                {(teacher.name || '?').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function DesktopEventRow({ event, onPress, language, testID }: { event: any; onPress: () => void; language: string; testID?: string }) {
  const title = (language === 'pt' && event.name_translations?.pt)
    ? event.name_translations.pt
    : event.name || event.name_translations?.en || '';
  const [isHovered, setIsHovered] = useState(false);

  const webHoverProps = Platform.OS === 'web' ? {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  } : {};

  return (
    <Pressable
      onPress={onPress}
      style={[styles.desktopRow, isHovered && styles.desktopRowHovered]}
      {...webHoverProps}
      testID={testID}
    >
      <TeacherAvatars teachers={event.teachers} />
      <View style={styles.desktopRowMain}>
        <Text style={styles.desktopRowName} numberOfLines={1}>{title}</Text>
        <Text style={styles.desktopRowSubDate} numberOfLines={1}>
          {event.startDate && event.endDate
            ? formatDateRangePretty(event.startDate, event.endDate, language)
            : event.startDate || '—'}
          {event.teachers?.length > 0 && ` · ${event.teachers.map((t: any) => t.name).filter(Boolean).join(', ')}`}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const { t, language } = useLanguage();
  const { isDesktop } = useDesktopLayout();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const isInGroupsStack = (segments as string[]).includes('(groups)');
  const { teacher: teacherFilter } = useGlobalSearchParams<{ teacher?: string }>();
  const [publicEvents, setPublicEvents] = useState<any[] | null>(() =>
    retreatService.getPublicEventsSync()
  );
  // Show spinner only when the lazy initializer found nothing in the mirror.
  const [loading, setLoading] = useState(() =>
    retreatService.getPublicEventsSync() === null
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('teachers');

  const loadEvents = async (isRefresh = false) => {
    // Show spinner only when the lazy initializer found no data in the mirror.
    if (publicEvents === null) setLoading(true);
    setError(null);

    try {
      const response = await retreatService.getPublicEvents({ force: isRefresh });
      if (response.success && response.data) {
        setPublicEvents(response.data);
      } else if (response.error?.includes('404')) {
        setPublicEvents([]);
      } else {
        setError(response.error || 'Failed to load events');
      }
    } catch (err) {
      console.error('Error loading public events:', err);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents(true);
    setRefreshing(false);
  };

  // If a teacher filter param is passed, switch to date view filtered by that teacher
  useEffect(() => {
    if (teacherFilter) setViewMode('date');
  }, [teacherFilter]);

  // Build teacher groups from events
  const teacherGroups = useMemo(() => {
    if (!publicEvents) return [];
    const map = new Map<string, TeacherGroup>();
    for (const event of publicEvents) {
      for (const teacher of event.teachers || []) {
        const key = teacher.abbreviation || teacher.name;
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          existing.eventCount++;
        } else {
          map.set(key, {
            name: teacher.name || '',
            abbreviation: teacher.abbreviation || '',
            photoUrl: teacher.photoUrl || null,
            avatarUrl: teacher.avatarUrl || null,
            avatarUpdatedAt: teacher.avatarUpdatedAt || null,
            eventCount: 1,
          });
        }
      }
    }
    // Sort by event count descending
    return Array.from(map.values()).sort((a, b) => b.eventCount - a.eventCount);
  }, [publicEvents]);

  // Filter events by teacher if a teacher filter is active
  const filteredEvents = useMemo(() => {
    if (!publicEvents) return null;
    if (!teacherFilter) return publicEvents;
    return publicEvents.filter((event: any) =>
      event.teachers?.some((t: any) => t.abbreviation === teacherFilter)
    );
  }, [publicEvents, teacherFilter]);

  const filterTeacherName = useMemo(() => {
    if (!teacherFilter || !publicEvents) return null;
    for (const event of publicEvents) {
      const teacher = event.teachers?.find((t: any) => t.abbreviation === teacherFilter);
      if (teacher) return teacher.name;
    }
    return teacherFilter;
  }, [teacherFilter, publicEvents]);

  const handleEventPress = (eventId: number) => {
    if (isInGroupsStack) {
      router.push({ pathname: '/(tabs)/(groups)/retreat/[id]', params: { id: String(eventId), from: 'events' } } as any);
    } else {
      router.push({ pathname: '/(tabs)/(events)/event/[id]', params: { id: String(eventId), from: 'events' } } as any);
    }
  };

  const handleTeacherPress = (abbreviation: string) => {
    router.push(`/(tabs)/(groups)/teacher/${abbreviation}` as any);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
            <Text style={styles.loadingText}>
              {t('common.loading') || 'Loading...'}
            </Text>
          </View>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.emptyState}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.emptyLogo}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>
              {t('common.connectionError') || 'Connection Error'}
            </Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadEvents}>
              <Text style={styles.retryButtonText}>{t('common.retry') || 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  // ── Date view: events grouped by year ──

  const renderDateView = () => {
    if (!filteredEvents || filteredEvents.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {t('groups.noPublicEvents') || 'No public events available at this time.'}
          </Text>
        </View>
      );
    }

    const eventsByYear: Record<number, any[]> = {};
    for (const event of filteredEvents) {
      const year = event.startDate ? new Date(event.startDate).getFullYear() : 0;
      if (!eventsByYear[year]) eventsByYear[year] = [];
      eventsByYear[year].push(event);
    }
    const years = Object.keys(eventsByYear).map(Number).sort((a, b) => b - a);

    if (isDesktop) {
      return years.map((year, yearIndex) => (
        <View key={year}>
          <View style={[styles.yearHeader, yearIndex === 0 ? styles.yearHeaderFirst : styles.yearHeaderSubsequent]}>
            <Text style={styles.yearHeaderText}>{year}</Text>
          </View>
          <View style={styles.desktopListContainer}>
            {eventsByYear[year].map((event: any) => (
              <DesktopEventRow
                key={event.id}
                event={event}
                onPress={() => handleEventPress(event.id)}
                language={language}
                testID={`event-card-${event.id}`}
              />
            ))}
          </View>
        </View>
      ));
    }

    return years.map((year, yearIndex) => (
      <View key={year}>
        <View style={[styles.yearHeaderMobile, yearIndex > 0 && styles.yearHeaderMobileSubsequent]}>
          <Text style={styles.yearHeaderTextMobile}>{year}</Text>
        </View>
        {eventsByYear[year].map((event: any) => (
          <EventCard
            key={event.id}
            event={event}
            onPress={() => handleEventPress(event.id)}
            language={language}
            testID={`event-card-${event.id}`}
          />
        ))}
      </View>
    ));
  };

  // ── Teachers view ──

  const renderTeachersView = () => {
    if (teacherGroups.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {t('groups.noPublicEvents') || 'No public events available at this time.'}
          </Text>
        </View>
      );
    }

    return teacherGroups.map((teacher) => (
      <TeacherRow
        key={teacher.abbreviation}
        teacher={teacher}
        onPress={() => handleTeacherPress(teacher.abbreviation)}
        t={t}
      />
    ));
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.burgundy[500]}
            />
          }
        >
          {/* Title with back button */}
          <View style={[styles.header, isDesktop && styles.desktopHeader]}>
            {!isDesktop && (
              <TouchableOpacity onPress={() => router.back()} style={styles.inlineBackButton}>
                <Ionicons name="arrow-back" size={22} color={colors.gray[800]} />
              </TouchableOpacity>
            )}
            <Text style={[styles.title, isDesktop && styles.desktopTitle]}>
              {filterTeacherName || t('home.teachingsAndTalks') || 'Teachings & Talks'}
            </Text>
            {teacherFilter && (
              <Pressable
                onPress={() => router.push(isInGroupsStack ? '/(tabs)/(groups)/events' : '/(tabs)/(events)' as any)}
                style={styles.clearFilterRow}
              >
                <Text style={styles.clearFilterText}>
                  {t('events.showAll') || 'Show all events'}
                </Text>
                <Ionicons name="close-circle" size={14} color={colors.gray[400]} />
              </Pressable>
            )}
          </View>

          {/* View mode tabs — only show when not filtering by a specific teacher */}
          {!teacherFilter && (
            <View style={styles.viewTabs}>
              <TouchableOpacity
                onPress={() => setViewMode('teachers')}
                style={[styles.viewTab, viewMode === 'teachers' && styles.viewTabActive]}
              >
                <Text style={[styles.viewTabText, viewMode === 'teachers' && styles.viewTabTextActive]}>
                  {t('events.teachers') || 'by teachers'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode('date')}
                style={[styles.viewTab, viewMode === 'date' && styles.viewTabActive]}
              >
                <Text style={[styles.viewTabText, viewMode === 'date' && styles.viewTabTextActive]}>
                  {t('events.date') || 'latest'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          {viewMode === 'teachers' && !teacherFilter ? renderTeachersView() : renderDateView()}

          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  inlineBackButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    marginRight: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  desktopHeader: {
    paddingTop: 44,
    paddingBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 30,
    fontFamily: 'MinionPro',
    color: colors.burgundy[500],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
  },
  desktopTitle: {
    fontSize: 28,
  },
  clearFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  clearFilterText: {
    fontSize: 13,
    color: colors.gray[400],
  },

  // View mode tabs
  viewTabs: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 20,
  },
  viewTab: {
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  viewTabActive: {
    borderBottomColor: colors.burgundy[500],
  },
  viewTabText: {
    fontSize: 15,
    fontFamily: 'EBGaramond_400Regular',
    color: colors.gray[400],
    fontVariant: ['small-caps'],
    letterSpacing: 0.3,
  },
  viewTabTextActive: {
    color: colors.burgundy[500],
    fontFamily: 'EBGaramond_600SemiBold',
  },

  // Teacher row
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  teacherAvatarLarge: {
    marginRight: 16,
  },
  teacherAvatarLargeImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  teacherAvatarFallback: {
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherAvatarFallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[600],
  },
  teacherRowInfo: {
    flex: 1,
  },
  teacherRowName: {
    fontSize: 18,
    fontFamily: 'EBGaramond_500Medium',
    color: colors.gray[800],
    marginBottom: 2,
  },
  teacherRowCount: {
    fontSize: 14,
    fontFamily: 'Avenir',
    color: colors.gray[500],
  },

  // Event card (date view, mobile)
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  eventCardAvatar: {
    marginRight: 14,
  },
  eventCardAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  eventCardInfo: {
    flex: 1,
  },
  eventCardTitle: {
    fontSize: 17,
    fontFamily: 'EBGaramond_500Medium',
    color: colors.gray[800],
    marginBottom: 2,
  },
  eventCardTeacher: {
    fontSize: 14,
    color: colors.burgundy[500],
    marginBottom: 2,
  },
  eventCardMeta: {
    fontSize: 13,
    color: colors.gray[500],
  },

  // Loading / empty / error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray[600],
    marginTop: 16,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyLogo: {
    width: 64,
    height: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 2,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Year headers
  yearHeader: {
    marginBottom: 12,
  },
  yearHeaderFirst: {
    paddingTop: 16,
  },
  yearHeaderSubsequent: {
    marginTop: 28,
  },
  yearHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  yearHeaderMobile: {
    paddingVertical: 8,
    marginBottom: 0,
  },
  yearHeaderMobileSubsequent: {
    marginTop: 16,
  },
  yearHeaderTextMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },

  // Desktop list styles
  desktopListContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  desktopRowHovered: {
    backgroundColor: '#fafafa',
  },
  desktopRowMain: {
    flex: 1,
    paddingRight: 16,
  },
  desktopRowName: {
    fontSize: 16,
    fontFamily: 'EBGaramond_500Medium',
    color: colors.gray[800],
  },
  desktopRowSubDate: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  desktopTeacherAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  desktopAvatarWrapper: {
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 20,
  },
  desktopAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  desktopAvatarFallbackText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray[600],
  },
});
