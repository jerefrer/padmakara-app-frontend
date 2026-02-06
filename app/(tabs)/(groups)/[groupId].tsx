import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, Stack, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { AppHeader } from '@/components/ui/AppHeader';
import { OfflineBadge } from '@/components/OfflineBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import retreatService from '@/services/retreatService';
import downloadService from '@/services/downloadService';
import { RetreatGroup, Gathering } from '@/types';

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
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface RetreatCardProps {
  retreat: Gathering;
  onPress: () => void;
  isDownloaded?: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function RetreatCard({ retreat, onPress, isDownloaded, t }: RetreatCardProps) {
  const totalTracks = retreat.sessions?.reduce((sum: number, session) => sum + (session.tracks?.length || 0), 0) || 0;

  // Format date range like "March 2nd to 4th" or "May 28th to June 1st"
  const formatDateRange = (startDateStr: string, endDateStr: string) => {
    try {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' });
      const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' });
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();

      // Add ordinal suffix
      const getOrdinal = (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      if (startMonth === endMonth) {
        return `${startMonth} ${getOrdinal(startDay)} to ${getOrdinal(endDay)}`;
      } else {
        return `${startMonth} ${getOrdinal(startDay)} to ${endMonth} ${getOrdinal(endDay)}`;
      }
    } catch {
      return `${startDateStr} to ${endDateStr}`;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.retreatCard}>
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.retreatTitleRow}>
            <Text style={styles.retreatTitle}>{retreat.name}</Text>
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

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [groupData, setGroupData] = useState<RetreatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadedRetreatIds, setDownloadedRetreatIds] = useState<Set<string>>(new Set());

  // Load downloaded retreat status
  const loadDownloadStatus = async () => {
    try {
      const downloaded = await downloadService.getDownloadedRetreats();
      setDownloadedRetreatIds(new Set(downloaded.map(r => r.retreatId)));
    } catch (err) {
      console.warn('Failed to load download status:', err);
    }
  };

  // Refresh download status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadDownloadStatus();
    }, [])
  );

  const loadGroupData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user retreats and find the specific group
      const response = await retreatService.getUserRetreats();

      if (response.success && response.data) {
        const group = response.data.retreat_groups.find(g => g.id === groupId);
        if (group) {
          setGroupData(group);
        } else {
          setError('Group not found');
        }
      } else {
        setError(response.error || 'Failed to load group data');
        console.error('Error loading group:', response.error);
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

  const handleRetryPress = () => {
    loadGroupData();
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
              <TouchableOpacity style={styles.retryButton} onPress={handleRetryPress}>
                <Text style={styles.retryButtonText}>{t('common.retry') || 'Try Again'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </>
    );
  }

  // Empty state - no retreats in group
  if (!groupData.gatherings || groupData.gatherings.length === 0) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            header: () => <AppHeader showBackButton={true} title={groupData.name} />
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
              You haven't attended any retreats in {groupData.name} yet.
            </Text>
          </View>
        </View>
      </>
    );
  }

  // Sort retreats by date (newest first) and group by year
  const sortedRetreats = [...groupData.gatherings].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  // Group retreats by year
  const retreatsByYear = sortedRetreats.reduce((acc, retreat) => {
    const year = retreat.year || new Date(retreat.startDate).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(retreat);
    return acc;
  }, {} as Record<number, Gathering[]>);

  // Get years in descending order
  const years = Object.keys(retreatsByYear).map(Number).sort((a, b) => b - a);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => <AppHeader showBackButton={true} title={groupData.name} />
        }}
      />
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {/* Group Description */}
          {groupData.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>{groupData.description}</Text>
            </View>
          )}

          {/* Retreats Count */}
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {sortedRetreats.length === 1
                ? (t('groups.retreatAttended', { count: sortedRetreats.length }) || '1 retreat attended')
                : (t('groups.retreatsAttended', { count: sortedRetreats.length }) || `${sortedRetreats.length} retreats attended`)
              }
            </Text>
          </View>

          {/* Retreats List grouped by year */}
          {years.map(year => (
            <View key={year}>
              <View style={styles.yearHeader}>
                <Text style={styles.yearHeaderText}>{year}</Text>
              </View>
              {retreatsByYear[year].map(retreat => (
                <RetreatCard
                  key={retreat.id}
                  retreat={retreat}
                  onPress={() => handleRetreatPress(retreat.id)}
                  isDownloaded={downloadedRetreatIds.has(retreat.id)}
                  t={t}
                />
              ))}
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
  descriptionContainer: {
    backgroundColor: colors.burgundy[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: colors.gray[600],
    lineHeight: 24,
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
  yearHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[700],
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
  },
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
});
