import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { AppHeader } from '@/components/ui/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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

interface GroupCardProps {
  group: RetreatGroup;
  onPress: () => void;
}

function GroupCard({ group, onPress, t }: GroupCardProps & { t: (key: string, params?: Record<string, unknown>) => string }) {
  const retreatCount = group.gatherings?.length || 0;

  return (
    <TouchableOpacity onPress={onPress} style={styles.groupCard}>
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.groupTitleRow}>
            <Text style={styles.groupTitle}>{group.name}</Text>
          </View>
          <Text style={styles.retreatsText}>
            {retreatCount === 1
              ? (t('groups.retreatAttended', { count: retreatCount }) || '1 retreat attended')
              : (t('groups.retreatsAttended', { count: retreatCount }) || `${retreatCount} retreats attended`)
            }
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
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
        console.error('Error loading retreats:', response.error);
      }
    } catch (err) {
      console.error('Error loading retreats:', err);
      setError('Failed to load retreats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserRetreats();
    }
  }, [user]);

  const handleGroupPress = (groupId: string) => {
    router.push(`/(tabs)/(groups)/${groupId}`);
  };

  const handleRetryPress = () => {
    loadUserRetreats();
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            header: () => <AppHeader />
          }}
        />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
            <Text style={styles.loadingText}>Loading your retreats...</Text>
          </View>
        </View>
      </>
    );
  }

  // Error state
  if (error || !retreatData) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            header: () => <AppHeader />
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
        </View>
      </>
    );
  }

  // Empty state
  if (!retreatData.retreat_groups || retreatData.retreat_groups.length === 0) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            header: () => <AppHeader />
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
              No Retreat Groups
            </Text>
            <Text style={styles.emptyText}>
              You haven't been assigned to any retreat groups yet. Please contact your administrator.
            </Text>
          </View>
        </View>
      </>
    );
  }

  const { retreat_groups: userGroups } = retreatData;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => <AppHeader />
        }}
      />
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {/* Page Title */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('groups.yourGroups') || 'Your groups'}</Text>
          </View>

          {/* Groups List */}
          {userGroups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              onPress={() => handleGroupPress(group.id)}
              t={t}
            />
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
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
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
  groupCard: {
    marginBottom: 16,
  },
  cardContent: {
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    flex: 1,
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
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
