import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { AppHeader } from '@/components/ui/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import retreatService from '@/services/retreatService';
import { RetreatGroup, Gathering } from '@/types';
import i18n from '@/utils/i18n';

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

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [groupData, setGroupData] = useState<RetreatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user retreats and find the specific group
      const response = await retreatService.getUserRetreats();
      
      if (response.success && response.data) {
        const group = response.data.retreat_groups.find(g => g.id === id);
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
    if (user && id) {
      loadGroupData();
    }
  }, [user, id]);

  const handleRetreatPress = (retreatId: string) => {
    router.push(`/retreat/${retreatId}`);
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
            header: () => <AppHeader showBackButton={true} title="Loading..." />
          }} 
        />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
            <Text style={styles.loadingText}>Loading group retreats...</Text>
          </View>
        </SafeAreaView>
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
            header: () => <AppHeader showBackButton={true} title="Error" />
          }} 
        />
        <SafeAreaView style={styles.container}>
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
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
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
        <SafeAreaView style={styles.container}>
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
        </SafeAreaView>
      </>
    );
  }

  // Sort retreats by date (newest first)
  const sortedRetreats = [...groupData.gatherings].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          header: () => <AppHeader showBackButton={true} title={groupData.name} />
        }} 
      />
      <SafeAreaView style={styles.container}>
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
              {sortedRetreats.length} retreat{sortedRetreats.length !== 1 ? 's' : ''} attended
            </Text>
          </View>

          {/* Retreats List */}
          {sortedRetreats.map(retreat => (
            <RetreatCard
              key={retreat.id}
              retreat={retreat}
              onPress={() => handleRetreatPress(retreat.id)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
});