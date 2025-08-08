import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { UserProgress, Track } from '@/types';
import { mockRetreatGroups } from '@/data/mockData';
import progressService from '@/services/progressService';
import i18n from '@/utils/i18n';

const colors = {
  cream: {
    100: '#fcf8f3',
    500: '#e8d8b7',
  },
  burgundy: {
    500: '#b91c1c',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

export default function HomeScreen() {
  const [recentActivity, setRecentActivity] = useState<UserProgress[]>([]);
  const [continueListening, setContinueListening] = useState<UserProgress[]>([]);
  const [stats, setStats] = useState({
    totalTracks: 0,
    completedTracks: 0,
    totalListeningTime: 0,
    averageProgress: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [recent, continuing, statistics] = await Promise.all([
        progressService.getRecentActivity(3),
        progressService.getContinueListening(3),
        progressService.getListeningStats(),
      ]);

      setRecentActivity(recent);
      setContinueListening(continuing);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading home screen data:', error);
    }
  };

  const findTrackById = (trackId: string): Track | null => {
    for (const group of mockRetreatGroups) {
      for (const gathering of group.gatherings) {
        for (const session of gathering.sessions) {
          const track = session.tracks.find(t => t.id === trackId);
          if (track) return track;
        }
      }
    }
    return null;
  };

  const formatListeningTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatProgress = (position: number, track: Track) => {
    const percentage = (position / track.duration) * 100;
    return `${Math.floor(percentage)}%`;
  };

  const navigateToRetreats = () => {
    router.push('/(tabs)/retreats');
  };

  const navigateToDownloads = () => {
    router.push('/(tabs)/downloads');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header with logo */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.title}>
            Padmakara
          </Text>
          <Text style={styles.subtitle}>
            {i18n.t('common.welcome')} to your retreat practice
          </Text>
        </View>

        {/* Welcome message */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {i18n.t('retreats.myRetreats')}
          </Text>
          <Text style={styles.cardText}>
            Access your retreat recordings, transcripts, and continue your spiritual journey from any device.
          </Text>
        </View>

        {/* Quick actions */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.buttonPrimary]}
            onPress={navigateToRetreats}
          >
            <Text style={styles.buttonText}>
              {i18n.t('navigation.retreats')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.buttonSecondary]}
            onPress={navigateToDownloads}
          >
            <Text style={styles.buttonText}>
              {i18n.t('navigation.downloads')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Listening Statistics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Progress</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.completedTracks}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalTracks}</Text>
              <Text style={styles.statLabel}>Total Tracks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatListeningTime(stats.totalListeningTime)}</Text>
              <Text style={styles.statLabel}>Listening Time</Text>
            </View>
          </View>
        </View>

        {/* Continue Listening */}
        {continueListening.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Continue Listening</Text>
            {continueListening.map((progress) => {
              const track = findTrackById(progress.trackId);
              if (!track) return null;
              
              return (
                <View key={progress.trackId} style={styles.trackItem}>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={2}>
                      {track.title}
                    </Text>
                    <View style={styles.trackMeta}>
                      <Text style={styles.trackProgress}>
                        {formatProgress(progress.position, track)}
                      </Text>
                      <Text style={styles.trackTime}>
                        {formatListeningTime(progress.position)} left
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${(progress.position / track.duration) * 100}%` }
                      ]} 
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            {recentActivity.map((progress) => {
              const track = findTrackById(progress.trackId);
              if (!track) return null;
              
              return (
                <View key={progress.trackId} style={styles.activityItem}>
                  <Text style={styles.activityTitle} numberOfLines={2}>
                    {track.title}
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(progress.lastPlayed).toLocaleDateString()}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            <Text style={styles.cardSubtext}>
              Your recent sessions will appear here once you start listening.
            </Text>
          </View>
        )}
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
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.burgundy[500],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: colors.gray[600],
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    color: colors.gray[700],
    lineHeight: 24,
  },
  cardSubtext: {
    fontSize: 16,
    color: colors.gray[500],
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.burgundy[500],
  },
  buttonSecondary: {
    backgroundColor: colors.saffron[500],
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.burgundy[500],
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray[600],
    marginTop: 4,
  },
  trackItem: {
    backgroundColor: colors.cream[100],
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  trackInfo: {
    marginBottom: 8,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 4,
  },
  trackMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackProgress: {
    fontSize: 12,
    color: colors.gray[600],
    fontWeight: '600',
  },
  trackTime: {
    fontSize: 12,
    color: colors.gray[500],
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray[300],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.burgundy[500],
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  activityTitle: {
    fontSize: 14,
    color: colors.gray[700],
    flex: 1,
    marginRight: 12,
  },
  activityTime: {
    fontSize: 12,
    color: colors.gray[500],
  },
});