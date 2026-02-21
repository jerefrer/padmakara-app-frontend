import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, router, Stack, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/ui/AppHeader';
import { OfflineBadge } from '@/components/OfflineBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import retreatService from '@/services/retreatService';
import downloadService from '@/services/downloadService';
import { RetreatGroup, Gathering } from '@/types';
import { getTranslatedName } from '@/utils/i18n';

const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    100: '#fde6e6',
    500: '#b91c1c',
    600: '#991b1b',
    700: '#7f1d1d',
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
    800: '#1f2937',
  },
  white: '#ffffff',
};

// ── Mobile card ──────────────────────────────────────────────────────────────

interface RetreatCardProps {
  retreat: Gathering;
  onPress: () => void;
  isDownloaded?: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
  language: string;
}

function RetreatCard({ retreat, onPress, isDownloaded, t, language }: RetreatCardProps) {
  const totalTracks = retreat.sessions?.reduce((sum: number, session) => sum + (session.tracks?.length || 0), 0) || 0;

  const formatDateRange = (startDateStr: string, endDateStr: string) => {
    try {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' });
      const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' });
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();
      const getOrdinal = (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      if (startMonth === endMonth) {
        return `${startMonth} ${getOrdinal(startDay)} to ${getOrdinal(endDay)}`;
      }
      return `${startMonth} ${getOrdinal(startDay)} to ${endMonth} ${getOrdinal(endDay)}`;
    } catch {
      return `${startDateStr} to ${endDateStr}`;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.retreatCard}>
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.retreatTitleRow}>
            <Text style={styles.retreatTitle}>{getTranslatedName(retreat, language as 'en' | 'pt')}</Text>
            {isDownloaded && <OfflineBadge />}
          </View>
          <View style={styles.retreatInfo}>
            <Text style={styles.dateText}>
              {formatDateRange(retreat.startDate, retreat.endDate)}
            </Text>
            <View style={styles.tracksBadge}>
              <Text style={styles.tracksBadgeText}>
                {totalTracks === 1
                  ? (t('retreats.track', { count: totalTracks }) || '1 track')
                  : (t('retreats.tracksPlural', { count: totalTracks }) || `${totalTracks} tracks`)
                }
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Desktop row ──────────────────────────────────────────────────────────────

function DesktopRetreatRow({ retreat, onPress, isDownloaded, t, language }: RetreatCardProps) {
  const totalTracks = retreat.sessions?.reduce((sum: number, session) => sum + (session.tracks?.length || 0), 0) || 0;
  const sessionCount = retreat.sessions?.length || 0;
  const [isHovered, setIsHovered] = useState(false);

  const formatDateShort = (startDateStr: string, endDateStr: string) => {
    try {
      const locale = language === 'pt' ? 'pt-PT' : 'en-US';
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const startMonth = startDate.toLocaleDateString(locale, { month: 'short' });
      const endMonth = endDate.toLocaleDateString(locale, { month: 'short' });
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();
      if (startMonth === endMonth) {
        return `${startMonth} ${startDay}–${endDay}`;
      }
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
    } catch {
      return `${startDateStr}`;
    }
  };

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
      <View style={styles.desktopRowIcon}>
        <Ionicons name="albums" size={20} color={colors.burgundy[500]} />
      </View>
      <View style={styles.desktopRowMain}>
        <Text style={styles.desktopRowName} numberOfLines={1}>
          {getTranslatedName(retreat, language as 'en' | 'pt')}
        </Text>
      </View>
      <View style={styles.desktopRowStat}>
        <Text style={styles.desktopRowStatValue}>{sessionCount}</Text>
        <Text style={styles.desktopRowStatLabel}>
          {sessionCount === 1 ? (t('events.sessionLabel') || 'session') : (t('events.sessionsLabel') || 'sessions')}
        </Text>
      </View>
      <View style={styles.desktopRowStat}>
        <Text style={styles.desktopRowStatValue}>{totalTracks}</Text>
        <Text style={styles.desktopRowStatLabel}>
          {totalTracks === 1 ? (t('groups.retreatLabel') || 'track') : (t('retreats.tracksLabel') || 'tracks')}
        </Text>
      </View>
      <View style={styles.desktopRowDate}>
        <Text style={styles.desktopRowDateText}>
          {formatDateShort(retreat.startDate, retreat.endDate)}
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
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { isDesktop } = useDesktopLayout();
  const [groupData, setGroupData] = useState<RetreatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadedRetreatIds, setDownloadedRetreatIds] = useState<Set<string>>(new Set());

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
      const response = await retreatService.getRetreatGroupDetails(groupId);
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
    if (user && groupId) {
      loadGroupData();
    }
  }, [user, groupId]);

  const handleRetreatPress = (retreatId: string) => {
    router.push(`/(tabs)/(groups)/retreat/${retreatId}`);
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            header: () => <AppHeader showBackButton={true} title={t('common.loading') || 'Loading...'} />
          }}
        />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
            <Text style={styles.loadingText}>{t('common.loading') || 'Loading...'}</Text>
          </View>
        </View>
      </>
    );
  }

  // Error state
  if (error || !groupData) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            header: () => <AppHeader showBackButton={true} title={t('common.error') || 'Error'} />
          }}
        />
        <View style={styles.container}>
          <View style={styles.emptyState}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.emptyLogo}
              contentFit="contain"
            />
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
        <Stack.Screen
          options={{
            headerShown: true,
            header: () => <AppHeader showBackButton={true} title={getTranslatedName(groupData, language)} />
          }}
        />
        <View style={styles.container}>
          <View style={styles.emptyState}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.emptyLogo}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>No Retreats Available</Text>
            <Text style={styles.emptyText}>
              You haven't attended any retreats in {getTranslatedName(groupData, language)} yet.
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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => <AppHeader showBackButton={true} title={groupName} />
        }}
      />
      <View style={styles.container}>
        <ScrollView style={[styles.scrollView, isDesktop && styles.desktopScrollView]}>
          {/* Desktop header */}
          {isDesktop && (
            <View style={styles.desktopPageHeader}>
              <Text style={styles.desktopPageTitle}>{groupName}</Text>
              <Text style={styles.statsText}>
                {sortedRetreats.length === 1
                  ? (t('groups.retreatAttended', { count: sortedRetreats.length }) || '1 retreat attended')
                  : (t('groups.retreatsAttended', { count: sortedRetreats.length }) || `${sortedRetreats.length} retreats attended`)
                }
              </Text>
            </View>
          )}

          {/* Mobile stats */}
          {!isDesktop && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>
                {sortedRetreats.length === 1
                  ? (t('groups.retreatAttended', { count: sortedRetreats.length }) || '1 retreat attended')
                  : (t('groups.retreatsAttended', { count: sortedRetreats.length }) || `${sortedRetreats.length} retreats attended`)
                }
              </Text>
            </View>
          )}

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
                  />
                ))
              )}
            </View>
          ))}
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
    paddingTop: 16,
  },
  desktopScrollView: {
    paddingHorizontal: 40,
    paddingTop: 0,
  },
  statsContainer: {
    marginBottom: 16,
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[700],
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
    color: colors.burgundy[500],
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
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Mobile card styles
  retreatCard: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.burgundy[500],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {},
  retreatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  retreatTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    flex: 1,
  },
  retreatInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: colors.gray[600],
  },
  tracksBadge: {
    backgroundColor: colors.burgundy[100],
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tracksBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.burgundy[700],
  },

  // Desktop styles
  desktopPageHeader: {
    paddingTop: 32,
    paddingBottom: 24,
  },
  desktopPageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.burgundy[500],
    marginBottom: 6,
  },
  desktopListContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  desktopRowHovered: {
    backgroundColor: colors.cream[50],
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
    color: colors.gray[800],
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
  desktopRowDate: {
    width: 120,
    paddingHorizontal: 12,
  },
  desktopRowDateText: {
    fontSize: 14,
    color: colors.gray[500],
  },
  desktopRowBadges: {
    width: 32,
    alignItems: 'center',
  },
});
