import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import i18n from '@/utils/i18n';
import { mockRetreatGroups, mockUser } from '@/data/mockData';

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

interface GatheringCardProps {
  gathering: any;
  onPress: () => void;
}

function GatheringCard({ gathering, onPress }: GatheringCardProps) {
  const totalTracks = gathering.sessions.reduce((sum: number, session: any) => sum + session.tracks.length, 0);
  const totalDuration = gathering.sessions.reduce((sum: number, session: any) => 
    sum + session.tracks.reduce((trackSum: number, track: any) => trackSum + track.duration, 0), 0
  );
  
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  return (
    <TouchableOpacity onPress={onPress} style={styles.gatheringCard}>
      <View style={styles.card}>
        <View style={styles.borderAccent} />
        <View style={styles.cardContent}>
          <Text style={styles.gatheringTitle}>{gathering.name}</Text>
          <Text style={styles.gatheringSubtitle}>
            {i18n.t(`retreats.${gathering.season}`)} {gathering.year}
          </Text>
          <View style={styles.gatheringInfo}>
            <View>
              <Text style={styles.infoText}>
                {totalTracks} tracks • {hours}h {minutes}m
              </Text>
              <Text style={styles.dateText}>
                {gathering.startDate} to {gathering.endDate}
              </Text>
            </View>
            <View style={styles.sessionsBadge}>
              <Text style={styles.sessionsBadgeText}>
                {gathering.sessions.length} {i18n.t('retreats.sessions').toLowerCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RetreatsScreen() {
  const userGroups = mockRetreatGroups.filter(group => 
    mockUser.retreatGroups.includes(group.id)
  );

  const handleGatheringPress = (groupId: string, gatheringId: string) => {
    router.push(`/gathering/${gatheringId}`);
  };

  if (userGroups.length === 0) {
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {i18n.t('retreats.myRetreats')}
          </Text>
          <Text style={styles.subtitle}>
            Access your retreat recordings and transcripts
          </Text>
        </View>

        {/* Retreat Groups */}
        {userGroups.map(group => (
          <View key={group.id} style={styles.groupSection}>
            <View style={[styles.card, styles.groupCard]}>
              <Text style={styles.groupTitle}>{group.name}</Text>
              <Text style={styles.groupDescription}>{group.description}</Text>
              <Text style={styles.groupStats}>
                {group.gatherings.length} gatherings • {group.members.length} members
              </Text>
            </View>

            {/* Gatherings */}
            <Text style={styles.sectionTitle}>
              Recent Gatherings
            </Text>
            {group.gatherings
              .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
              .map(gathering => (
                <GatheringCard
                  key={gathering.id}
                  gathering={gathering}
                  onPress={() => handleGatheringPress(group.id, gathering.id)}
                />
              ))
            }
          </View>
        ))}

        {/* Quick Stats */}
        <View style={styles.card}>
          <Text style={styles.statsTitle}>Your Progress</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.burgundy[500] }]}>
                {userGroups.reduce((sum, group) => sum + group.gatherings.length, 0)}
              </Text>
              <Text style={styles.statLabel}>Gatherings</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.saffron[500] }]}>
                {userGroups.reduce((sum, group) => 
                  sum + group.gatherings.reduce((gSum, gathering) => 
                    gSum + gathering.sessions.reduce((sSum, session) => 
                      sSum + session.tracks.length, 0), 0), 0)}
              </Text>
              <Text style={styles.statLabel}>Total Tracks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.burgundy[500] }]}>2</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
          </View>
        </View>
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
  gatheringCard: {
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
  gatheringTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 4,
  },
  gatheringSubtitle: {
    fontSize: 16,
    color: colors.gray[600],
    marginBottom: 16,
  },
  gatheringInfo: {
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
});