import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Pressable } from 'react-native';
import { Stack, router, useGlobalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/ui/AppHeader';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import retreatService from '@/services/retreatService';

const colors = {
  cream: {
    50: '#ffffff',
    100: '#fefefe',
  },
  burgundy: {
    50: '#f8f1f1',
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

/** Format seconds into "Xh Ym" or "Ym" */
function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '—';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/** Compute total duration of all tracks in an event */
function getEventTotalDuration(event: any): number {
  let total = 0;
  for (const session of event.sessions || []) {
    for (const track of session.tracks || []) {
      total += track.duration || 0;
    }
  }
  return total;
}

// ── Mobile card ──────────────────────────────────────────────────────────────

interface PublicEventCardProps {
  event: any;
  onPress: () => void;
  language: string;
}

function PublicEventCard({ event, onPress, language }: PublicEventCardProps) {
  const title = (language === 'pt' && event.name_translations?.pt)
    ? event.name_translations.pt
    : event.name || event.name_translations?.en || '';
  const sessionCount = event.sessions?.length || 0;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.groupCard}>
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.groupTitle}>{title}</Text>
          {event.startDate && (
            <Text style={styles.eventDate}>{formatDate(event.startDate)}</Text>
          )}
          <Text style={styles.retreatsText}>
            {sessionCount === 1 ? '1 session' : `${sessionCount} sessions`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Desktop row ──────────────────────────────────────────────────────────────

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
  // Show up to 3 teacher photos, stacked/overlapping
  const shown = teachers.slice(0, 3);
  return (
    <View style={styles.teacherAvatars}>
      {shown.map((teacher: any, i: number) => (
        <View key={teacher.abbreviation || i} style={[styles.teacherAvatarWrapper, i > 0 && { marginLeft: -8 }]}>
          {teacher.photoUrl ? (
            <Image source={{ uri: teacher.photoUrl }} style={styles.teacherAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.teacherAvatar, styles.teacherAvatarFallback]}>
              <Text style={styles.teacherAvatarText}>
                {(teacher.name || '?').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function TeacherNames({ teachers, language }: { teachers?: any[]; language: string }) {
  if (!teachers || teachers.length === 0) return null;
  const names = teachers.map((t: any) => t.name).filter(Boolean);
  if (names.length === 0) return null;
  return (
    <Text style={styles.desktopRowTeacherNames} numberOfLines={1}>
      {names.join(', ')}
    </Text>
  );
}

function DesktopEventRow({ event, onPress, language, t }: PublicEventCardProps & { t: (key: string) => string }) {
  const title = (language === 'pt' && event.name_translations?.pt)
    ? event.name_translations.pt
    : event.name || event.name_translations?.en || '';
  const totalDuration = getEventTotalDuration(event);
  const sessionCount = event.sessions?.length || 0;
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
      {sessionCount > 1 && (
        <View style={styles.desktopRowStat}>
          <Text style={styles.desktopRowStatValue}>{sessionCount}</Text>
          <Text style={styles.desktopRowStatLabel}>sessions</Text>
        </View>
      )}
      <View style={styles.desktopRowStat}>
        <Text style={styles.desktopRowStatValue}>{formatDuration(totalDuration)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
    </Pressable>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const { t, language } = useLanguage();
  const { isDesktop } = useDesktopLayout();
  const { teacher: teacherFilter } = useGlobalSearchParams<{ teacher?: string }>();
  const [publicEvents, setPublicEvents] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await retreatService.getPublicEvents();
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

  // Filter events by teacher if a teacher filter is active
  const filteredEvents = useMemo(() => {
    if (!publicEvents) return null;
    if (!teacherFilter) return publicEvents;
    return publicEvents.filter((event: any) =>
      event.teachers?.some((t: any) => t.abbreviation === teacherFilter)
    );
  }, [publicEvents, teacherFilter]);

  // Get the teacher name for display when filtering
  const filterTeacherName = useMemo(() => {
    if (!teacherFilter || !publicEvents) return null;
    for (const event of publicEvents) {
      const teacher = event.teachers?.find((t: any) => t.abbreviation === teacherFilter);
      if (teacher) return teacher.name;
    }
    return teacherFilter;
  }, [teacherFilter, publicEvents]);

  const handleEventPress = (eventId: number) => {
    router.push({ pathname: '/(tabs)/(events)/event/[id]', params: { id: String(eventId), from: 'events' } } as any);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
        <View style={styles.container}>
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
        <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
        <View style={styles.container}>
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

  return (
    <>
      <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
      <View style={styles.container}>
        <ScrollView style={[styles.scrollView, isDesktop && styles.desktopScrollView]}>
          <View style={[styles.header, isDesktop && styles.desktopHeader]}>
            <Text style={[styles.title, isDesktop && styles.desktopTitle]}>
              {filterTeacherName || t('groups.publicEvents') || 'Public Events'}
            </Text>
            {teacherFilter && (
              <Pressable
                onPress={() => router.push('/(tabs)/(events)' as any)}
                style={styles.clearFilterRow}
              >
                <Text style={styles.clearFilterText}>
                  {t('events.showAll') || 'Show all events'}
                </Text>
                <Ionicons name="close-circle" size={14} color={colors.gray[400]} />
              </Pressable>
            )}
          </View>

          {filteredEvents && filteredEvents.length > 0 ? (
            (() => {
              // Group events by year
              const eventsByYear: Record<number, any[]> = {};
              for (const event of filteredEvents) {
                const year = event.startDate ? new Date(event.startDate).getFullYear() : 0;
                if (!eventsByYear[year]) eventsByYear[year] = [];
                eventsByYear[year].push(event);
              }
              const years = Object.keys(eventsByYear).map(Number).sort((a, b) => b - a);

              return isDesktop ? (
                <>
                  {years.map((year, yearIndex) => (
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
                            t={t}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <>
                  {years.map((year, yearIndex) => (
                    <View key={year}>
                      <View style={[styles.yearHeaderMobile, yearIndex > 0 && styles.yearHeaderMobileSubsequent]}>
                        <Text style={styles.yearHeaderTextMobile}>{year}</Text>
                      </View>
                      {eventsByYear[year].map((event: any) => (
                        <PublicEventCard
                          key={event.id}
                          event={event}
                          onPress={() => handleEventPress(event.id)}
                          language={language}
                        />
                      ))}
                    </View>
                  ))}
                </>
              );
            })()
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {t('groups.noPublicEvents') || 'No public events available at this time.'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  desktopScrollView: {
    paddingHorizontal: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
  header: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  desktopHeader: {
    paddingTop: 36,
    paddingBottom: 0,
  },
  desktopTitle: {
    fontSize: 28,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
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
  title: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
  },

  // Mobile card styles
  card: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 24,
    paddingVertical: 20,
    paddingHorizontal: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  groupCard: {
    marginBottom: 16,
  },
  cardContent: {},
  groupTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: colors.gray[500],
    marginBottom: 4,
  },
  retreatsText: {
    fontSize: 14,
    color: colors.gray[600],
  },
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
    paddingTop: 52,
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
    marginBottom: 8,
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
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'visible',
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  desktopRowHovered: {
    backgroundColor: '#fafafa',
  },
  desktopRowIcon: {
    width: 40,
    alignItems: 'center',
  },
  desktopRowMain: {
    flex: 1,
    paddingRight: 16,
  },
  desktopRowName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
  },
  desktopRowSubDate: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  teacherAvatars: {
    width: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: 28,
  },
  teacherAvatarWrapper: {
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 20,
  },
  teacherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  teacherAvatarFallback: {
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherAvatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray[600],
  },
  desktopRowTeacherNames: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  desktopRowStat: {
    width: 90,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  desktopRowStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.burgundy[500],
  },
  desktopRowStatLabel: {
    fontSize: 13,
    color: colors.gray[500],
  },
});
