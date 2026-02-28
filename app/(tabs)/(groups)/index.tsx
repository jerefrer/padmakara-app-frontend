import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Pressable } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/ui/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import retreatService from '@/services/retreatService';
import { RetreatGroup, Gathering } from '@/types';
import { getTranslatedName } from '@/utils/i18n';

const colors = {
  cream: {
    50: '#ffffff',
    100: '#fefefe',
  },
  burgundy: {
    50: '#f8f1f1',
    500: '#9b1b1b',
    600: '#7b1616',
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

// ── Mobile GroupCard (unchanged) ─────────────────────────────────────────────

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

// ── Desktop GroupRow ─────────────────────────────────────────────────────────

function DesktopGroupRow({ group, onPress, t, language }: GroupCardProps & { t: (key: string, params?: Record<string, unknown>) => string; language: string }) {
  const retreatCount = group.gatherings?.length || 0;
  const [isHovered, setIsHovered] = useState(false);

  // Find most recent gathering
  const lastGathering = group.gatherings?.length
    ? group.gatherings.reduce((latest, g) => {
        const d = new Date(g.startDate);
        return !latest || d > new Date(latest.startDate) ? g : latest;
      }, null as Gathering | null)
    : null;

  const lastRetreatLabel = lastGathering
    ? getTranslatedName(lastGathering, language as 'en' | 'pt')
    : null;

  // Compute initials from group name
  const groupName = getTranslatedName(group, language as 'en' | 'pt');
  const abbr = group.abbreviation
    || groupName.split(/\s+/).map(w => w[0]).join('').substring(0, 3).toUpperCase();

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
      {/* Group initials circle */}
      <View style={styles.desktopRowCircle}>
        <Text style={styles.desktopRowCircleText}>{abbr}</Text>
      </View>

      {/* Group name + last retreat */}
      <View style={styles.desktopRowMain}>
        <Text style={styles.desktopRowName} numberOfLines={1}>
          {groupName}
        </Text>
        {lastRetreatLabel && (
          <Text style={styles.desktopRowSub} numberOfLines={1}>
            {t('groups.lastRetreat') || 'Last retreat'}: {lastRetreatLabel}
          </Text>
        )}
      </View>

      {/* Retreat count */}
      <View style={styles.desktopRowStat}>
        <Text style={styles.desktopRowStatValue}>{retreatCount}</Text>
        <Text style={styles.desktopRowStatLabel}>
          {retreatCount === 1
            ? (t('groups.retreatLabel') || 'retreat')
            : (t('groups.retreatsLabel') || 'retreats')
          }
        </Text>
      </View>

      {/* Arrow */}
      <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
    </Pressable>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function RetreatsScreen() {
  const { user, isAuthenticated, hasActiveSubscription, refreshUserData } = useAuth();
  const { t, language } = useLanguage();
  const { isDesktop } = useDesktopLayout();
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

  // Refresh user data (including subscription status) when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshUserData();
      }
    }, [isAuthenticated])
  );

  const handleGroupPress = (groupId: string) => {
    router.push(`/(tabs)/(groups)/${groupId}`);
  };

  const handleSignInPress = () => {
    router.push({ pathname: '/(auth)/magic-link', params: { returnTo: '/(tabs)/(groups)' } });
  };

  // ─── Not authenticated: welcoming sign-in prompt ────────────────────────────
  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
        <View style={styles.container}>
          <View style={styles.welcomeState}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.welcomeLogo}
              contentFit="contain"
            />
            <Text style={styles.welcomeTitle}>
              {t('groups.signInRequired') || 'Welcome to Padmakara'}
            </Text>
            <View style={styles.welcomeDivider} />
            <Text style={styles.welcomeText}>
              {t('groups.signInPrompt') || 'Access recordings and transcripts from your retreat group\'s gatherings.'}
            </Text>
            <TouchableOpacity style={styles.welcomeButton} onPress={handleSignInPress}>
              <Text style={styles.welcomeButtonText}>
                {t('groups.signIn') || 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  // ─── Authenticated but no subscription: platform-aware prompt ────────────
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
              {t('groups.accountRequired') || 'Access to Retreat Recordings'}
            </Text>
            {Platform.OS === 'web' ? (
              <>
                <Text style={styles.emptyText}>
                  {t('groups.accountRequiredDesktop') || 'Subscribe to listen to your retreat group\'s recordings.'}
                </Text>
                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={() => router.push('/(tabs)/subscription')}
                >
                  <Text style={styles.signInButtonText}>
                    {t('subscription.subscribe') || 'Subscribe'} — {t('subscription.price') || '€5/month'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>
                  {t('groups.accountRequiredMobile') || 'An active account is needed to access your retreat recordings.'}
                </Text>
                <Text style={[styles.emptyText, { marginTop: 8, fontStyle: 'italic' }]}>
                  {t('groups.setupAccount') || 'Visit app.padmakara.pt to set up your account'}
                </Text>
              </>
            )}
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
        <ScrollView style={[styles.scrollView, isDesktop && styles.desktopScrollView]}>
          {/* Page title */}
          {isDesktop ? (
            <View style={styles.desktopHeader}>
              <Text style={styles.desktopPageTitle}>
                {t('groups.yourRetreatGroups') || 'Your retreat groups'}
              </Text>
            </View>
          ) : (
            <View style={styles.header}>
              <Text style={styles.title}>{t('groups.yourGroups') || 'Your groups'}</Text>
            </View>
          )}

          {/* Desktop: clean row-based list; Mobile: stacked cards */}
          {isDesktop ? (
            <View style={styles.desktopListContainer}>
              {/* Group rows (no column headers) */}
              {retreatData.retreat_groups.map(group => (
                <DesktopGroupRow
                  key={group.id}
                  group={group}
                  onPress={() => handleGroupPress(group.id)}
                  t={t}
                  language={language}
                />
              ))}
            </View>
          ) : (
            retreatData.retreat_groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                onPress={() => handleGroupPress(group.id)}
                t={t}
                language={language}
              />
            ))
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  welcomeState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  welcomeLogo: {
    width: 80,
    height: 80,
    marginBottom: 32,
    opacity: 0.6,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  welcomeDivider: {
    width: 48,
    height: 1,
    backgroundColor: colors.burgundy[500],
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.gray[600],
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: 36,
  },
  welcomeSubtle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray[400],
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'EBGaramond_400Regular',
    marginBottom: 32,
  },
  welcomeButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 44,
    paddingVertical: 14,
    borderRadius: 2,
  },
  welcomeButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
    paddingVertical: 20,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  groupCard: {
    marginBottom: 0,
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
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
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
    borderRadius: 2,
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
    borderRadius: 2,
    marginTop: 20,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Desktop styles
  desktopScrollView: {
    paddingHorizontal: 40,
  },
  desktopHeader: {
    paddingTop: 36,
    paddingBottom: 24,
  },
  desktopPageTitle: {
    fontSize: 28,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
  },

  // Desktop list
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
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  desktopRowHovered: {
    backgroundColor: '#fafafa',
  },
  desktopRowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  desktopRowCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray[600],
    letterSpacing: 0.3,
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
  desktopRowSub: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  desktopRowStat: {
    width: 100,
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
