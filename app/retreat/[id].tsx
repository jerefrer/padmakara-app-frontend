import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import retreatService from '@/services/retreatService';
import { Session } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

const colors = {
  cream: {
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

interface RetreatDetails {
  id: string;
  name: string;
  season: string;
  year: number;
  startDate: string;
  endDate: string;
  sessions: Session[];
  retreat_group: {
    id: string;
    name: string;
  };
}

export default function RetreatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [retreat, setRetreat] = useState<RetreatDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRetreatDetails();
  }, [id]);

  const loadRetreatDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await retreatService.getRetreatDetails(id);
      if (response.success && response.data) {
        setRetreat(response.data);
      } else {
        setError(response.error || 'Failed to load retreat details');
      }
    } catch (err) {
      setError('Failed to load retreat details');
      console.error('Load retreat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionPress = (sessionId: string) => {
    router.push(`/session/${sessionId}`);
  };

  const handleDownloadAllRetreat = async () => {
    try {
      if (!retreat) return;
      
      // Count total tracks across all sessions
      const totalTracks = retreat.sessions.reduce((sum, session) => 
        sum + (session.tracks?.length || 0), 0
      );
      
      if (totalTracks === 0) {
        Alert.alert('No Tracks', 'This retreat has no tracks to download.');
        return;
      }
      
      Alert.alert(
        'Download Retreat',
        `Download all ${totalTracks} tracks from "${retreat.name}" for offline playback?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download All',
            onPress: async () => {
              console.log(`🔽 Starting bulk download for retreat: ${retreat.name}`);
              
              let successCount = 0;
              let failCount = 0;
              
              for (const session of retreat.sessions) {
                console.log(`📂 Downloading session: ${session.name}`);
                
                if (session.tracks) {
                  for (const track of session.tracks) {
                    console.log(`📊 Downloading track: ${track.title}`);
                    
                    const result = await retreatService.downloadTrack(track.id);
                    
                    if (result.success) {
                      successCount++;
                    } else {
                      failCount++;
                      console.error(`Failed to download track ${track.title}:`, result.error);
                    }
                  }
                }
              }
              
              if (successCount === totalTracks) {
                Alert.alert('Download Complete', `All ${successCount} tracks downloaded successfully.`);
              } else if (successCount > 0) {
                Alert.alert('Partial Download', `${successCount} tracks downloaded, ${failCount} failed.`);
              } else {
                Alert.alert('Download Failed', 'Failed to download any tracks. Please check your connection.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Bulk retreat download error:', error);
      Alert.alert('Error', 'Failed to download retreat.');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>Loading retreat...</Text>
        </View>
      </View>
    );
  }

  if (error || !retreat) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Retreat not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header Section - unmovable */}
      <SafeAreaView edges={['top']} style={styles.fixedHeaderContainer}>
        {/* Navigation Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{retreat.name}</Text>
            <Text style={styles.headerSubtitle}>
              {t(`retreats.${retreat.season}`)} {retreat.year}
            </Text>
          </View>
        </View>

        {/* Download Retreat Button */}
        <View style={styles.retreatActions}>
          <TouchableOpacity
            onPress={handleDownloadAllRetreat}
            style={styles.downloadAllButton}
          >
            <Ionicons name="download" size={20} color="white" />
            <Text style={styles.downloadAllButtonText}>
              Download Retreat ({retreat.sessions.reduce((sum, s) => sum + (s.tracks?.length || 0), 0)} tracks)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sessions Header */}
        <View style={styles.sessionsHeaderSection}>
          <Text style={styles.sessionsTitle}>
            {t('retreats.sessions')} ({retreat.sessions.length})
          </Text>
        </View>
      </SafeAreaView>

      {/* Scrollable Sessions List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {retreat.sessions
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((session) => {
              return (
                <TouchableOpacity
                  key={session.id}
                  onPress={() => handleSessionPress(session.id)}
                  style={styles.sessionCard}
                >
                  <View style={styles.borderAccent} />
                  <View style={styles.cardContent}>
                    <Text style={styles.sessionName}>{session.name}</Text>
                    <Text style={styles.sessionInfo}>
                      {session.tracks?.length || 0} tracks • {t(`retreats.${session.type}`)}
                    </Text>
                    <Text style={styles.sessionDate}>
                      {new Date(session.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={colors.gray[400]} 
                  />
                </TouchableOpacity>
              );
            })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  fixedHeaderContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: colors.burgundy[500],
    fontSize: 16,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.burgundy[500],
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
    marginTop: 2,
  },
  content: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollContent: {
    padding: 16,
  },
  retreatActions: {
    padding: 16,
    backgroundColor: 'white',
  },
  sessionsHeaderSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  downloadAllButton: {
    backgroundColor: colors.burgundy[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  downloadAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  sessionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    position: 'relative',
  },
  borderAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.burgundy[500],
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  cardContent: {
    flex: 1,
    paddingLeft: 8,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 4,
  },
  sessionInfo: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 12,
    color: colors.gray[500],
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.gray[600],
    marginBottom: 20,
  },
});