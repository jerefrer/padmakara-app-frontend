import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, RefreshControl } from 'react-native';
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
import { DraftBadge } from '@/components/DraftBadge';
import { ForthcomingBadge } from '@/components/ForthcomingBadge';
import { NowPlayingBadge } from '@/components/NowPlayingBadge';
import { OfflineBadge } from '@/components/OfflineBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useHero } from '@/utils/heroVariant';
import { useFocalCover } from '@/hooks/useFocalCover';
import { pickFrameOverride } from '@/utils/heroFrames';
import { groupHeroCacheKey } from '@/utils/cacheKeys';
import retreatService from '@/services/retreatService';
import downloadService from '@/services/downloadService';
import { RetreatGroup, Gathering } from '@/types';
import { getTranslatedName } from '@/utils/i18n';
import { mainTeachers } from '@/utils/eventTeachers';
import { formatDateRangePretty } from '@/utils/retreatDates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui/BackButton';
import { EventRow } from '@/components/EventRow';
import { useBottomBarsSpace } from '@/components/MiniPlayer';
import { SectionRule } from '@/components/ui/SectionRule';
import { LIST_AVATAR_SIZE, SUBDIVISION_COLOR, SUBDIVISION_THICKNESS, TEXT_GUTTER } from '@/constants/layout';
import { ListRowPressable } from '@/components/ui/ListRowPressable';

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

// ── Mobile card ──────────────────────────────────────────────────────────────

interface RetreatCardProps {
  retreat: Gathering;
  onPress: () => void;
  isDownloaded?: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
  language: string;
  groupNameForStrip: string | null;
}

function RetreatCard({ retreat, onPress, isDownloaded, language, groupNameForStrip }: RetreatCardProps) {
  const totalTracks = retreat.sessions?.reduce((sum: number, session) => sum + (session.tracks?.length || 0), 0) || 0;
  const rawName = getTranslatedName(retreat, language as 'en' | 'pt');
  const displayName = cleanEventName(rawName, groupNameForStrip);
  const meta = formatDateRangePretty(retreat.startDate, retreat.endDate, language)
    + (totalTracks > 0 ? ` · ${totalTracks} ${totalTracks === 1 ? 'track' : 'tracks'}` : '');

  return (
    <EventRow
      event={retreat}
      title={displayName}
      meta={meta}
      onPress={onPress}
      badge={isDownloaded ? <OfflineBadge /> : undefined}
    />
  );
}

// ── Desktop row ──────────────────────────────────────────────────────────────

function DesktopRetreatRow({ retreat, onPress, isDownloaded, language, groupNameForStrip }: RetreatCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rawName = getTranslatedName(retreat, language as 'en' | 'pt');
  const displayName = cleanEventName(rawName, groupNameForStrip);
  // Compact row: main teachers only, never the guests (see utils/eventTeachers).
  const teachers = mainTeachers(retreat.teachers);
  const leadTeacher = teachers[0];
  const leadAvatar = leadTeacher?.avatarUrl || leadTeacher?.photoUrl || null;

  const webHoverProps = Platform.OS === 'web' ? {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  } : {};

  return (
    <ListRowPressable
      onPress={onPress}
      style={[styles.desktopRow, isHovered && styles.desktopRowHovered]}
      {...webHoverProps}
    >
      {/* Round picture of the lead teacher, as large as the Personal Library's group pictures. The
          other teachers are named in the line under the title. */}
      <View style={styles.desktopAvatarGroup}>
        {leadAvatar ? (
          <Image
            source={{ uri: leadAvatar, cacheKey: leadTeacher?.avatarUpdatedAt ? `teacher-avatar-${leadTeacher.abbreviation}-${leadTeacher.avatarUpdatedAt}` : undefined }}
            style={styles.desktopAvatarImg}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.desktopAvatarImg, styles.retreatAvatarFallback]}>
            {leadTeacher?.name ? (
              <Text style={styles.desktopAvatarFallbackText}>
                {leadTeacher.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="people-outline" size={28} color={colors.gray[400]} />
            )}
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
        {retreat.status === 'draft' && <DraftBadge />}
        {retreat.status === 'forthcoming' && <ForthcomingBadge />}
        {isDownloaded && <OfflineBadge />}
      </View>
    </ListRowPressable>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function GroupDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { isDesktop } = useDesktopLayout();
  const insets = useSafeAreaInsets();
  const bottomBarsSpace = useBottomBarsSpace();
  const scrollY = useSharedValue(0);
  const [groupData, setGroupData] = useState<RetreatGroup | null>(() =>
    retreatService.getRetreatGroupDetailsSync(code)
  );
  // Show spinner only when the lazy initializer found nothing in the mirror.
  const [loading, setLoading] = useState(() =>
    retreatService.getRetreatGroupDetailsSync(code) === null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadedRetreatIds, setDownloadedRetreatIds] = useState<Set<string>>(new Set());

  const { url: groupHeroSrc, variant: groupHeroVariant } = useHero(groupData);
  const heroFocalCover = useFocalCover({
    focalX: groupData?.heroFocalX ?? 50,
    focalY: groupData?.heroFocalY ?? 50,
    frameHeight: HERO_HEIGHT,
    override: pickFrameOverride(groupData?.heroFrameOverrides, 'page'),
  });

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
      // Only show the full-screen spinner when the lazy initializer found no
      // cached data in the mirror. retreatService reads cache-first, so
      // when the mirror is warm this is a background refresh with no spinner.
      if (groupData === null) setLoading(true);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await retreatService.getRetreatGroupDetails(code, { force: true });
    await loadGroupData();
    setRefreshing(false);
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
            <BackButton variant="inline" />
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
            <BackButton variant="inline" />
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
            <BackButton variant="inline" />
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

  const groupName = getTranslatedName(groupData, language);
  const hasHero = !!groupHeroSrc;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, !hasHero && { paddingTop: insets.top }]}>
        <Animated.ScrollView
          style={styles.scrollView}
          // The tab bar and the mini player float over the list on phones.
          contentContainerStyle={isDesktop ? styles.desktopScrollContent : { paddingBottom: bottomBarsSpace }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.burgundy[500]}
            />
          }
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
                source={{ uri: groupHeroSrc!, cacheKey: groupHeroCacheKey(groupData as any, groupHeroVariant) }}
                style={[
                  StyleSheet.absoluteFill,
                  // The legacy scale yields to a per-frame framing, which already carries its own zoom.
                  !heroFocalCover.hasOverride && (groupData.heroScale ?? 100) !== 100 && {
                    transform: [{ scale: (groupData.heroScale ?? 100) / 100 }],
                  },
                  heroFocalCover.zoomStyle,
                ]}
                contentFit="cover"
                contentPosition={heroFocalCover.contentPosition}
                onLayout={heroFocalCover.onLayout}
                onLoad={heroFocalCover.onLoad}
              />
            </Animated.View>
          )}

          {/* Page title with back button. When a hero is shown the back arrow
              floats over the image; otherwise it sits inline next to the title. */}
          <View style={isDesktop ? styles.desktopPageHeader : [styles.mobileTitleHeader, styles.indented]}>
            {!isDesktop && !hasHero && (
              <BackButton variant="inline" />
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

          {/* Light red rule opens the list; light black lines separate the rows. No year headers:
              each row's date carries its year, so the rows are evenly spaced. */}
          <SectionRule contained={isDesktop} />

          {sortedRetreats.map(retreat =>
            isDesktop ? (
              <DesktopRetreatRow
                key={retreat.id}
                retreat={retreat}
                onPress={() => handleRetreatPress(retreat.id)}
                isDownloaded={downloadedRetreatIds.has(retreat.id)}
                t={t}
                language={language}
                groupNameForStrip={groupNameForStrip}
              />
            ) : (
              <RetreatCard
                key={retreat.id}
                retreat={retreat}
                onPress={() => handleRetreatPress(retreat.id)}
                isDownloaded={downloadedRetreatIds.has(retreat.id)}
                t={t}
                language={language}
                groupNameForStrip={groupNameForStrip}
              />
            ),
          )}
        </Animated.ScrollView>

        {/* Floating back button — only when hero is shown, sits over the image */}
        {hasHero && (
          <BackButton variant="overlay" style={[styles.floatingBackButton, { top: insets.top + 8 }]} />
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
  },
  // Mobile content runs edge to edge: text is indented per element so that
  // row separators can start at the left screen edge.
  indented: {
    paddingHorizontal: TEXT_GUTTER,
  },
  desktopScrollContent: {
    paddingHorizontal: 40,
  },
  standaloneBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: TEXT_GUTTER,
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
    marginBottom: 8,
  },
  desktopHeroContainer: {
    // Break out of the desktop ScrollView's 40px padding.
    marginHorizontal: -40,
  },
  floatingBackButton: {
    position: 'absolute',
    left: 12,
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

  retreatAvatarFallback: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
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
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: SUBDIVISION_THICKNESS,
    borderBottomColor: SUBDIVISION_COLOR,
  },
  desktopRowHovered: {
    backgroundColor: '#fafafa',
  },
  // The lead teacher's round picture, the size of the Personal Library's group pictures.
  desktopAvatarGroup: {
    marginRight: 14,
  },
  desktopAvatarImg: {
    width: LIST_AVATAR_SIZE,
    height: LIST_AVATAR_SIZE,
    borderRadius: LIST_AVATAR_SIZE / 2,
  },
  desktopAvatarFallbackText: {
    fontSize: 22,
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
    minWidth: 60,
    alignItems: 'center',
  },
});
