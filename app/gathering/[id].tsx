import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AudioPlayerDemo } from '@/components/AudioPlayerDemo';
import { mockRetreatGroups } from '@/data/mockData';
import { Track, Session, Gathering, UserProgress } from '@/types';
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
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

export default function GatheringDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Find the gathering
  const gathering: Gathering | undefined = mockRetreatGroups
    .flatMap(group => group.gatherings)
    .find(g => g.id === id);

  if (!gathering) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Gathering not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get all tracks in order
  const allTracks: Track[] = gathering.sessions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .flatMap(session => session.tracks.sort((a, b) => a.order - b.order));

  const currentTrack = allTracks[currentTrackIndex];

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const selectTrack = (trackIndex: number) => {
    setCurrentTrackIndex(trackIndex);
  };

  const handleProgressUpdate = (progress: UserProgress) => {
    // In production, this would sync with your backend
    console.log('Progress updated:', progress);
  };

  const handleTrackComplete = () => {
    // Auto-advance to next track
    if (currentTrackIndex < allTracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    } else {
      Alert.alert('Gathering Complete', 'You have finished all tracks in this gathering!');
    }
  };

  const goToNextTrack = () => {
    if (currentTrackIndex < allTracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    }
  };

  const goToPreviousTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{gathering.name}</Text>
          <Text style={styles.headerSubtitle}>
            {t(`retreats.${gathering.season}`)} {gathering.year}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Track Player */}
        {currentTrack && (
          <AudioPlayerDemo
            track={currentTrack}
            onProgressUpdate={handleProgressUpdate}
            onTrackComplete={handleTrackComplete}
            onNextTrack={currentTrackIndex < allTracks.length - 1 ? goToNextTrack : undefined}
            onPreviousTrack={currentTrackIndex > 0 ? goToPreviousTrack : undefined}
          />
        )}

        {/* Sessions List */}
        <View style={styles.sessionsList}>
          <Text style={styles.sessionsTitle}>
            {t('retreats.sessions')} ({gathering.sessions.length})
          </Text>
          
          {gathering.sessions
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((session, sessionIndex) => {
              const isExpanded = expandedSessions.has(session.id);
              const sessionTrackStartIndex = gathering.sessions
                .slice(0, sessionIndex)
                .reduce((sum, s) => sum + s.tracks.length, 0);
              
              return (
                <View key={session.id} style={styles.sessionCard}>
                  <TouchableOpacity
                    onPress={() => toggleSession(session.id)}
                    style={styles.sessionHeader}
                  >
                    <View>
                      <Text style={styles.sessionName}>{session.name}</Text>
                      <Text style={styles.sessionInfo}>
                        {session.tracks.length} tracks • {t(`retreats.${session.type}`)}
                      </Text>
                      <Text style={styles.sessionDate}>
                        {new Date(session.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={colors.gray[500]} 
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.tracksList}>
                      {session.tracks
                        .sort((a, b) => a.order - b.order)
                        .map((track, trackIndex) => {
                          const globalTrackIndex = sessionTrackStartIndex + trackIndex;
                          const isCurrentTrack = globalTrackIndex === currentTrackIndex;
                          
                          return (
                            <TouchableOpacity
                              key={track.id}
                              onPress={() => selectTrack(globalTrackIndex)}
                              style={[
                                styles.trackItem,
                                isCurrentTrack && styles.currentTrackItem
                              ]}
                            >
                              <View style={styles.trackInfo}>
                                <Text style={[
                                  styles.trackTitle,
                                  isCurrentTrack && styles.currentTrackTitle
                                ]}>
                                  {track.title}
                                </Text>
                                <View style={styles.trackMeta}>
                                  <Text style={styles.trackDuration}>
                                    {formatDuration(track.duration)}
                                  </Text>
                                  <TouchableOpacity
                                    onPress={() => router.push(`/transcript/${track.id}`)}
                                    style={styles.transcriptButton}
                                  >
                                    <Ionicons name="document-text-outline" size={14} color={colors.burgundy[500]} />
                                    <Text style={styles.transcriptButtonText}>Transcript</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                              {isCurrentTrack && (
                                <Ionicons 
                                  name="play-circle" 
                                  size={20} 
                                  color={colors.burgundy[500]} 
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  )}
                </View>
              );
            })}
        </View>

        {/* Track Navigation */}
        <View style={styles.trackNavigation}>
          <Text style={styles.navigationTitle}>Track Navigation</Text>
          <Text style={styles.navigationInfo}>
            Track {currentTrackIndex + 1} of {allTracks.length}
          </Text>
          
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              onPress={goToPreviousTrack}
              disabled={currentTrackIndex === 0}
              style={[
                styles.navButton,
                currentTrackIndex === 0 && styles.navButtonDisabled
              ]}
            >
              <Ionicons name="play-skip-back" size={20} color="white" />
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={goToNextTrack}
              disabled={currentTrackIndex === allTracks.length - 1}
              style={[
                styles.navButton,
                currentTrackIndex === allTracks.length - 1 && styles.navButtonDisabled
              ]}
            >
              <Text style={styles.navButtonText}>Next</Text>
              <Ionicons name="play-skip-forward" size={20} color="white" />
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
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
  },
  sessionsList: {
    padding: 16,
  },
  sessionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 16,
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
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
  tracksList: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  trackItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  currentTrackItem: {
    backgroundColor: colors.burgundy[50],
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    color: colors.gray[700],
    marginBottom: 4,
  },
  currentTrackTitle: {
    color: colors.burgundy[600],
    fontWeight: '600',
  },
  trackDuration: {
    fontSize: 12,
    color: colors.gray[500],
  },
  trackMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transcriptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.burgundy[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transcriptButtonText: {
    fontSize: 12,
    color: colors.burgundy[500],
    marginLeft: 4,
    fontWeight: '600',
  },
  trackNavigation: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 8,
  },
  navigationInfo: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 16,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.45,
    justifyContent: 'center',
  },
  navButtonDisabled: {
    backgroundColor: colors.gray[400],
  },
  navButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
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