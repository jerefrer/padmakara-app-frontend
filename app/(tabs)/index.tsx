import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import i18n from '@/utils/i18n';
import { useAuth } from '@/contexts/AuthContext';
import retreatService from '@/services/retreatService';
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
    700: '#7f1d1d',
  },
  saffron: {
    50: '#fffbeb',
    500: '#f59e0b',
  },
  gray: {
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface RetreatCardProps {
  retreat: Gathering;
  onPress: () => void;
}

function RetreatCard({ retreat, onPress }: RetreatCardProps) {
  const totalTracks = retreat.sessions?.reduce((sum: number, session) => sum + (session.tracks?.length || 0), 0) || 0;
  const totalDuration = retreat.sessions?.reduce((sum: number, session) => 
    sum + (session.tracks?.reduce((trackSum: number, track) => trackSum + track.duration, 0) || 0), 0
  ) || 0;
  
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  // Format dates
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.retreatCard}>
      <View style={styles.card}>
        <View style={styles.borderAccent} />
        <View style={styles.cardContent}>
          <Text style={styles.retreatTitle}>{retreat.name}</Text>
          <Text style={styles.retreatSubtitle}>
            {i18n.t(`retreats.${retreat.season}`)} {retreat.year}
          </Text>
          <View style={styles.retreatInfo}>
            <View>
              <Text style={styles.infoText}>
                {totalTracks} tracks • {hours}h {minutes}m
              </Text>
              <Text style={styles.dateText}>
                {formatDate(retreat.startDate)} to {formatDate(retreat.endDate)}
              </Text>
            </View>
            <View style={styles.sessionsBadge}>
              <Text style={styles.sessionsBadgeText}>
                {retreat.sessions?.length || 0} {i18n.t('retreats.sessions').toLowerCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [retreatData, setRetreatData] = useState<{
    retreat_groups: RetreatGroup[];
    recent_gatherings: Gathering[];
    total_stats: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserRetreats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await retreatService.getUserRetreats();
      
      if (response.success && response.data) {
        setRetreatData(response.data);
      } else {
        setError(response.error || 'Failed to load retreats');
        // Store error but don't show alert immediately for offline-first behavior
        console.error('Error loading retreats:', response.error);
      }
    } catch (err) {
      console.error('Error loading retreats:', err);
      setError('Failed to load retreats');
      // For offline-first behavior, we could load cached data here
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserRetreats();
    }
  }, [user]);

  const handleRetreatPress = (retreatId: string) => {
    router.push(`/retreat/${retreatId}`);
  };

  const handleRetryPress = () => {
    loadUserRetreats();
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>Loading your retreats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !retreatData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.emptyLogo}
            contentFit="contain"
          />
          <Text style={styles.emptyTitle}>
            {error ? 'Connection Error' : 'No Retreat Groups'}
          </Text>
          <Text style={styles.emptyText}>
            {error || 'You haven\'t been assigned to any retreat groups yet. Please contact your administrator.'}
          </Text>
          {error && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetryPress}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!retreatData.retreat_groups || retreatData.retreat_groups.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.emptyLogo}
            contentFit="contain"
          />
          <Text style={styles.emptyTitle}>
            No Retreat Groups
          </Text>
          <Text style={styles.emptyText}>
            You haven't been assigned to any retreat groups yet. Please contact your administrator.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { retreat_groups: userGroups, total_stats } = retreatData;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* All Retreats List */}
        {userGroups.flatMap(group => 
          (group.gatherings || []).map(retreat => ({ ...retreat, groupName: group.name }))
        )
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
          .map(retreat => (
            <RetreatCard
              key={retreat.id}
              retreat={retreat}
              onPress={() => handleRetreatPress(retreat.id)}
            />
          ))
        }
      </ScrollView>
    </SafeAreaView>
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
  },
  header: {
    paddingVertical: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.burgundy[500],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray[600],
  },
  groupSection: {
    marginBottom: 32,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupCard: {
    backgroundColor: colors.burgundy[50],
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 16,
    color: colors.gray[600],
    marginBottom: 8,
  },
  groupStats: {
    fontSize: 14,
    color: colors.gray[600],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 12,
  },
  retreatCard: {
    marginBottom: 16,
  },
  borderAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.burgundy[500],
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardContent: {
    paddingLeft: 8,
  },
  retreatTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 4,
  },
  retreatSubtitle: {
    fontSize: 16,
    color: colors.gray[600],
    marginBottom: 16,
  },
  retreatInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: colors.gray[600],
  },
  dateText: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 4,
  },
  sessionsBadge: {
    backgroundColor: colors.burgundy[100],
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  sessionsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.burgundy[700],
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
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
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});