import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Pressable } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useLocalSearchParams, router, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { OfflineBadge } from '@/components/OfflineBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useHero } from '@/utils/heroVariant';
import { groupHeroCacheKey } from '@/utils/cacheKeys';
import retreatService from '@/services/retreatService';
import downloadService from '@/services/downloadService';
import { RetreatGroup, Gathering } from '@/types';
import { getTranslatedName } from '@/utils/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HERO_HEIGHT = 380;
const HERO_COLLAPSE_END = 230;

const colors = {
  cream: {
    50: '#ffffff',
    100: '#ffffff',
  },
  burgundy: {
    50: '#f8f1f1',
    100: '#f2e0e0',
    500: '#9b1b1b',
    600: '#7b1616',
    700: '#5a1111',
  },
  saffron: {
    50: '#fffbeb',
    500: '#f59e0b',
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Remove the group name suffix from event names, e.g. "Spring Retreat | Śamatha" → "Spring Retreat"
 *  when viewing the Śamatha group page (since the group name is already the page title). */
function cleanEventName(name: string, groupName: string | null): string {
  if (!groupName) return name;
  // Strip " | GroupName" suffix (case-insensitive)
  const suffix = ` | ${groupName}`;
  if (name.toLowerCase().endsWith(suffix.toLowerCase())) {
    return name.slice(0, -suffix.length).trim();
  }
  return name;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Format a date range nicely: "April 18th" (single day), "November 1st–5th" (same month), etc. */
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
      // Portuguese: "18 de abril", "1–5 de novembro"
      if (startDay === endDay && startMonth === endMonth) {
        return `${startDay} de ${startMonth}`;
      }
      if (startMonth === endMonth) {
        return `${startDay}–${endDay} de ${startMonth}`;
      }
      return `${startDay} de ${startMonth} – ${endDay} de ${endMonth}`;
    }

    // English: "April 18th", "November 1st–5th"
    if (startDay === endDay && startMonth === endMonth) {
      return `${startMonth} ${getOrdinal(startDay)}`;
    }
    if (startMonth === endMonth) {
      return `${startMonth} ${getOrdinal(startDay)}–${getOrdinal(endDay)}`;
    }
    return `${startMonth} ${getOrdinal(startDay)} – ${endMonth} ${getOrdinal(endDay)}`;
  } catch {
    return `${startDateStr}`;
  }
}

/** Split a list into chunks of n items. */
function chunkInto<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(items.slice(i, i + n));
  }
  return out;
}

// ── Mobile card ──────────────────────────────────────────────────────────────

interface RetreatCardProps {
  retreat: Gathering;
  onPress: () => void;
  isDownloaded?: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
  language: string;
  groupNameForStrip: string | null;
}

function RetreatCard({ retreat, onPress, isDownloaded, t, language, groupNameForStrip }: RetreatCardProps) {
  const totalTracks = retreat.sessions?.reduce((sum: number, session) => sum + (session.tracks?.length || 0), 0) || 0;
  const rawName = getTranslatedName(retreat, language as 'en' | 'pt');
  const displayName = cleanEventName(rawName, groupNameForStrip);
  const teachers = retreat.teachers || [];
  const teacherNames = teachers.map((t) => t.name).filter(Boolean).join(', ') || '';

  return (
    <TouchableOpacity onPress={onPress} style={styles.retreatCard}>
      <View style={styles.retreatCardRow}>
        {/* Teacher avatars (stacked/overlapping) */}
        <View style={styles.retreatAvatarContainer}>
          {teachers.length > 0 ? (
            teachers.slice(0, 3).map((teacher, i, arr) => (
              <View
                key={teacher.abbreviation || i}
                style={[
                  styles.retreatAvatarWrapper,
                  i > 0 && { marginLeft: -16 },
                  { zIndex: arr.length - i },
                ]}
              >
                {(teacher.avatarUrl || teacher.photoUrl) ? (
                  <Image source={{ uri: (teacher.avatarUrl || teacher.photoUrl)! }} cacheKey={teacher.avatarUpdatedAt ? `teacher-avatar-${teacher.abbreviation}-${teacher.avatarUpdatedAt}` : undefined} style={styles.retreatAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.retreatAvatar, styles.retreatAvatarFallback]}>
                    <Text style={styles.retreatAvatarFallbackText}>
                      {(teacher.name || '?').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={[styles.retreatAvatar, styles.retreatAvatarFallback]}>
              <Ionicons name="people-outline" size={20} color={colors.gray[400]} />
            </View>
          )}
        </View>
        {/* Info */}
        <View style={styles.retreatCardInfo}>
          <View style={styles.retreatTitleRow}>
            <Text style={styles.retreatTitle} numberOfLines={2}>{displayName}</Text>
            {isDownloaded && <OfflineBadge />}
          </View>
          {teacherNames ? (
            <Text style={styles.retreatTeacherNames} numberOfLines={1}>{teacherNames}</Text>
          ) : null}
          <Text style={styles.dateText}>
            {formatDateRangePretty(retreat.startDate, retreat.endDate, language)}
            {totalTracks > 0 ? ` · ${totalTracks} ${totalTracks === 1 ? 'track' : 'tracks'}` : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Desktop row ──────────────────────────────────────────────────────────────

function DesktopRetreatRow({ retreat, onPress, isDownloaded, language, groupNameForStrip }: RetreatCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rawName = getTranslatedName(retreat, language as 'en' | 'pt');
  const displayName = cleanEventName(rawName, groupNameForStrip);
  const teachers = retreat.teachers || [];

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
      {/* Teacher avatars — fixed-width column reserving space for 3 per row.
          Within a row avatars overlap (stacked look); when there are more
          than 3 teachers, additional rows of up-to-3 wrap below. The fixed
          column width keeps every event title aligned across rows regardless
          of how many teachers each event has. */}
      <View style={styles.desktopAvatarGroup}>
        {teachers.length > 0 ? (
          (() => {
            const rows = chunkInto(teachers, 3);
            return rows.map((row, rowIdx) => (
              <View
                key={rowIdx}
                style={[
                  styles.desktopAvatarRow,
                  rowIdx > 0 && { marginTop: -8 },
                  // First row stays on top; subsequent rows tuck under it,
                  // so the principal teachers (always row 0) remain the most
                  // visible.
                  { zIndex: rows.length - rowIdx },
                ]}
              >
                {row.map((teacher, i, arr) => (
                <View
                  key={teacher.abbreviation || i}
                  style={[
                    styles.desktopAvatarWrapper,
                    i > 0 && { marginLeft: -8 },
                    { zIndex: arr.length - i },
                  ]}
                >
                  {(teacher.avatarUrl || teacher.photoUrl) ? (
                    <Image
                      source={{ uri: (teacher.avatarUrl || teacher.photoUrl)! }}
                      cacheKey={teacher.avatarUpdatedAt ? `teacher-avatar-${teacher.abbreviation}-${teacher.avatarUpdatedAt}` : undefined}
                      style={styles.desktopAvatarImg}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.desktopAvatarImg, styles.retreatAvatarFallback]}>
                      <Text style={styles.desktopAvatarFallbackText}>
                        {(teacher.name || '?').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            ));
          })()
        ) : (
          <View style={[styles.desktopAvatarImg, styles.retreatAvatarFallback]}>
            <Ionicons name="people-outline" size={18} color={colors.gray[400]} />
          </View>
        )}
      </View>
      <View style={styles.desktopRowMain}>
        <Text style={styles.desktopRowName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.desktopRowDate} numberOfLines={1}>
          {formatDateRangePretty(retreat.startDate, retreat.endDate, language)}
          {teachers.length > 0 && ` · ${teachers.map((t) => t.name).filter(Boolean).join(', ')}`}
        </Text>
      </View>
      <View style={styles.desktopRowBadges}>
        {isDownloaded && <OfflineBadge />}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
    </Pressable>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function GroupDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { isDesktop } = useDesktopLayout();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [groupData, setGroupData] = useState<RetreatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadedRetreatIds, setDownloadedRetreatIds] = useState<Set<string>>(new Set());

  const { url: groupHeroSrc, variant: groupHeroVariant } = useHero(groupData);

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

  const loadDownloadStatus = async () => {
    try {
      const downloaded = await downloadService.getDownloadedRetreats();
      setDownloadedRetreatIds(new Set(downloaded.map(r => r.retreatId)));
    } catch (err) {
      console.warn('Failed to load download status:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadDownloadStatus();
    }, [])
  );

  const loadGroupData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await retreatService.getRetreatGroupDetails(code);
      if (response.success && response.data) {
        setGroupData(response.data);
      } else {
        setError(response.error || 'Failed to load group data');
      }
    } catch (err) {
      console.error('Error loading group:', err);
      setError('Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && code) {
      loadGroupData();
    }
  }, [user, code]);

  const handleRetreatPress = (retreatId: string) => {
    router.push(`/(tabs)/(groups)/retreat/${retreatId}`);
  };

  // Group name used to strip " | GroupName" suffix from event names
  const groupNameForStrip = groupData ? getTranslatedName(groupData, language as 'en' | 'pt') : null;

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.standaloneBackRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.inlineBackButton}>
              <Ionicons name="arrow-back" size={22} color={colors.gray[800]} />
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
          </View>
        </View>
      </>
    );
  }

  // Error state
  if (error || !groupData) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.standaloneBackRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.inlineBackButton}>
              <Ionicons name="arrow-back" size={22} color={colors.gray[800]} />
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {error === 'Group not found' ? 'Group Not Found' : 'Connection Error'}
            </Text>
            <Text style={styles.emptyText}>
              {error || 'Could not load group data. Please try again.'}
            </Text>
            {error && error !== 'Group not found' && (
              <TouchableOpacity style={styles.retryButton} onPress={() => loadGroupData()}>
                <Text style={styles.retryButtonText}>{t('common.retry') || 'Try Again'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </>
    );
  }

  // Empty state
  if (!groupData.gatherings || groupData.gatherings.length === 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.standaloneBackRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.inlineBackButton}>
              <Ionicons name="arrow-back" size={22} color={colors.gray[800]} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.pageTitleSmallCaps, { paddingHorizontal: 24 }]}>
            {getTranslatedName(groupData, language)}
          </Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {t('groups.noRetreats') || 'No retreats available yet.'}
            </Text>
          </View>
        </View>
      </>
    );
  }

  // Sort and group by year
  const sortedRetreats = [...groupData.gatherings].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const retreatsByYear = sortedRetreats.reduce((acc, retreat) => {
    const year = retreat.year || new Date(retreat.startDate).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(retreat);
    return acc;
  }, {} as Record<number, Gathering[]>);

  const years = Object.keys(retreatsByYear).map(Number).sort((a, b) => b - a);
  const groupName = getTranslatedName(groupData, language);
  const hasHero = !!groupHeroSrc;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, !hasHero && { paddingTop: insets.top }]}>
        <Animated.ScrollView
          style={[styles.scrollView, isDesktop && styles.desktopScrollView]}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {/* Collapsing hero — same edge-to-edge banner pattern on mobile
              and desktop. Spans full ScrollView width by negating the
              horizontal padding. */}
          {hasHero && (
            <Animated.View
              style={[
                styles.heroContainer,
                isDesktop && styles.desktopHeroContainer,
                heroStyle,
              ]}
            >
              <Image
                source={{ uri: groupHeroSrc! }}
                cacheKey={groupHeroCacheKey(groupData as any, groupHeroVariant)}
                style={[
                  StyleSheet.absoluteFillObject,
                  (groupData.heroScale ?? 100) !== 100 && {
                    transform: [{ scale: (groupData.heroScale ?? 100) / 100 }],
                  },
                ]}
                contentFit="cover"
                contentPosition={{
                  left: `${groupData.heroFocalX ?? 50}%`,
                  top: `${groupData.heroFocalY ?? 50}%`,
                }}
              />
            </Animated.View>
          )}

          {/* Page title with back button. When a hero is shown the back arrow
              floats over the image; otherwise it sits inline next to the title. */}
          <View style={isDesktop ? styles.desktopPageHeader : styles.mobileTitleHeader}>
            {!isDesktop && !hasHero && (
              <TouchableOpacity onPress={() => router.back()} style={styles.inlineBackButton}>
                <Ionicons name="arrow-back" size={22} color={colors.gray[800]} />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitleSmallCaps}>{groupName}</Text>
              <Text style={styles.statsText}>
                {sortedRetreats.length}{' '}
                {sortedRetreats.length === 1
                  ? (t('groups.retreatLabel') || 'Retreat')
                  : (t('groups.retreatsLabel') || 'Retreats')
                }
              </Text>
            </View>
          </View>

          {/* Retreats grouped by year */}
          {years.map(year => (
            <View key={year}>
              <View style={[styles.yearHeader, isDesktop && styles.desktopYearHeader]}>
                <Text style={[styles.yearHeaderText, isDesktop && styles.desktopYearHeaderText]}>{year}</Text>
              </View>

              {isDesktop ? (
                <View style={styles.desktopListContainer}>
                  {retreatsByYear[year].map(retreat => (
                    <DesktopRetreatRow
                      key={retreat.id}
                      retreat={retreat}
                      onPress={() => handleRetreatPress(retreat.id)}
                      isDownloaded={downloadedRetreatIds.has(retreat.id)}
                      t={t}
                      language={language}
                      groupNameForStrip={groupNameForStrip}
                    />
                  ))}
                </View>
              ) : (
                retreatsByYear[year].map(retreat => (
                  <RetreatCard
                    key={retreat.id}
                    retreat={retreat}
                    onPress={() => handleRetreatPress(retreat.id)}
                    isDownloaded={downloadedRetreatIds.has(retreat.id)}
                    t={t}
                    language={language}
                    groupNameForStrip={groupNameForStrip}
                  />
                ))
              )}
            </View>
          ))}
        </Animated.ScrollView>

        {/* Floating back button — only when hero is shown, sits over the image */}
        {hasHero && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.floatingBackButton, { top: insets.top + 8 }]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
        )}
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
    paddingHorizontal: 24,
    paddingTop: 0,
  },
  desktopScrollView: {
    paddingHorizontal: 40,
    paddingTop: 0,
  },
  standaloneBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
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
  mobileTitleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  heroContainer: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: colors.gray[200],
    // Break out of the ScrollView's horizontal padding so the image
    // spans edge to edge.
    marginHorizontal: -24,
    marginBottom: 8,
  },
  desktopHeroContainer: {
    // Match the desktop ScrollView's wider 40px padding.
    marginHorizontal: -40,
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
  },
  pageTitleSmallCaps: {
    fontSize: 30,
    fontFamily: 'MinionPro',
    color: colors.burgundy[500],
    fontVariant: ['small-caps'] as any,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statsText: {
    fontSize: 14,
    color: colors.gray[500],
    fontWeight: '500',
  },
  yearHeader: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  desktopYearHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  yearHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  desktopYearHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    lineHeight: 24,
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

  // Mobile card styles
  retreatCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  retreatCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  retreatAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },
  retreatAvatarWrapper: {
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 27,
  },
  retreatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  retreatAvatarFallback: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retreatAvatarFallbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[600],
  },
  retreatCardInfo: {
    flex: 1,
  },
  retreatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  retreatTitle: {
    fontSize: 17,
    fontFamily: 'EBGaramond_500Medium',
    color: colors.gray[800],
    flex: 1,
  },
  retreatTeacherNames: {
    fontSize: 14,
    color: colors.burgundy[500],
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: colors.gray[500],
  },

  // Desktop styles
  desktopPageHeader: {
    paddingTop: 36,
    paddingBottom: 24,
  },
  desktopPageTitle: {
    fontSize: 30,
    fontFamily: 'MinionPro',
    color: colors.burgundy[500],
    fontVariant: ['small-caps'] as any,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  desktopListContainer: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'visible',
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    marginBottom: 8,
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  desktopRowHovered: {
    backgroundColor: '#fafafa',
  },
  desktopAvatarGroup: {
    // Fixed width sized to fit 3 stacked avatars (44px each with white
    // border, overlapping by 8px → 44 + 36 + 36 = 116). Always reserves
    // this space so titles align across rows regardless of teacher count.
    // Vertical row stacking is handled by negative marginTop on rows after
    // the first, so no `gap` here.
    width: 116,
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginRight: 20,
  },
  desktopAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopAvatarWrapper: {
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 22,
  },
  desktopAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  desktopAvatarFallbackText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray[600],
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
  desktopRowDate: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  desktopRowBadges: {
    width: 32,
    alignItems: 'center',
  },
});
