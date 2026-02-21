import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/ui/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import retreatService from '@/services/retreatService';
import { RetreatGroup, Gathering } from '@/types';
import { getTranslatedName } from '@/utils/i18n';

const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    500: '#b91c1c',
    600: '#991b1b',
  },
  gray: {
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface GroupCardProps {
  group: RetreatGroup;
  onPress: () => void;
}

function GroupCard({ group, onPress, t, language }: GroupCardProps & { t: (key: string, params?: Record<string, unknown>) => string; language: string }) {
  const retreatCount = group.gatherings?.length || 0;

  return (
    <TouchableOpacity onPress={onPress} style={styles.groupCard}>
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.groupTitleRow}>
            <Text style={styles.groupTitle}>{getTranslatedName(group, language as 'en' | 'pt')}</Text>
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

export default function RetreatsScreen() {
  const { user, isAuthenticated, hasActiveSubscription } = useAuth();
  const { t, language } = useLanguage();
  const [retreatData, setRetreatData] = useState<{
    retreat_groups: RetreatGroup[];
    recent_gatherings: Gathering[];
    total_stats: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContent = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await retreatService.getUserRetreats();
      if (response.success && response.data) {
        setRetreatData(response.data);
      } else {
        setError(response.error || 'Failed to load retreats');
      }
    } catch (err) {
      console.error('Error loading retreats:', err);
      setError('Failed to load retreats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, [isAuthenticated, user]);

  const handleGroupPress = (groupId: string) => {
    router.push(`/(tabs)/(groups)/${groupId}`);
  };

  const handleSignInPress = () => {
    router.push({ pathname: '/(auth)/magic-link', params: { returnTo: '/(tabs)/(groups)' } });
  };

  // ─── Not authenticated: prompt to sign in ─────────────────────────────────
  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
        <View style={styles.container}>
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyTitle}>
              {t('groups.signInRequired') || 'Sign In Required'}
            </Text>
            <Text style={styles.emptyText}>
              {t('groups.signInPrompt') || 'Retreat participants can sign in to access their recordings.'}
            </Text>
            <TouchableOpacity style={styles.signInButton} onPress={handleSignInPress}>
              <Text style={styles.signInButtonText}>
                {t('groups.signIn') || 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  // ─── Authenticated but no subscription: gentle prompt ───────────────────
  if (!hasActiveSubscription) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
        <View style={styles.container}>
          <View style={styles.emptyState}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.heroLogo}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>
              {t('subscription.registerCta') || 'Retreat participants can sign in to access their group\'s recordings.'}
            </Text>
            <Text style={styles.emptyText}>
              {t('subscription.manageOnWeb') || 'Manage your account at app.padmakara.pt'}
            </Text>
          </View>
        </View>
      </>
    );
  }

  // Loading state
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

  // Error state
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
            <TouchableOpacity style={styles.retryButton} onPress={loadContent}>
              <Text style={styles.retryButtonText}>{t('common.retry') || 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  // ─── No groups ──────────────────────────────────────────────────────────────
  if (!retreatData?.retreat_groups || retreatData.retreat_groups.length === 0) {
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
              {t('groups.noGroups') || 'No Retreat Groups'}
            </Text>
            <Text style={styles.emptyText}>
              {t('groups.noGroupsDescription') || "You haven't been assigned to any retreat groups yet. Please contact your administrator."}
            </Text>
          </View>
        </View>
      </>
    );
  }

  // ─── Groups list ────────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('groups.yourGroups') || 'Your groups'}</Text>
          </View>
          {retreatData.retreat_groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              onPress={() => handleGroupPress(group.id)}
              t={t}
              language={language}
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
    paddingBottom: 80,
  },
  emptyLogo: {
    width: 64,
    height: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  heroLogo: {
    width: 120,
    height: 120,
    marginBottom: 24,
    opacity: 0.7,
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupCard: {
    marginBottom: 16,
  },
  cardContent: {},
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
  signInButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
