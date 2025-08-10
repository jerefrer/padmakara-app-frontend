import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AudioPlayer } from '@/components/AudioPlayer';
import retreatService from '@/services/retreatService';
import { Track, UserProgress } from '@/types';
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
    50: '#fffbeb',
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface SessionDetails {
  id: string;
  name: string;
  type: string;
  date: string;
  tracks: Track[];
  gathering: {
    id: string;
    name: string;
  };
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadedTracks, setDownloadedTracks] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSessionDetails();
  }, [id]);
  
  useEffect(() => {
    if (session) {
      loadDownloadedTracks();
    }
  }, [session]);

  const loadSessionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await retreatService.getSessionDetails(id);
      if (response.success && response.data) {
        setSession(response.data);
      } else {
        setError(response.error || 'Failed to load session details');
      }
    } catch (err) {
      setError('Failed to load session details');
      console.error('Load session error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDownloadedTracks = async () => {
    try {
      if (session?.tracks) {
        const downloadedTrackIds = new Set<string>();
        
        // Check each track to see if it's downloaded
        for (const track of session.tracks) {
          const isDownloaded = await retreatService.isTrackDownloaded(track.id);
          if (isDownloaded) {
            downloadedTrackIds.add(track.id);
          }
        }
        
        setDownloadedTracks(downloadedTrackIds);
        console.log(`📥 Found ${downloadedTrackIds.size} downloaded tracks`);
      }
    } catch (error) {
      console.error('Load downloaded tracks error:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Session not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get all tracks in order
  const allTracks: Track[] = session.tracks.sort((a, b) => a.order - b.order);
  const currentTrack = allTracks[currentTrackIndex];

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
      Alert.alert('Session Complete', 'You have finished all tracks in this session!');
    }
  };

  const handleDownloadTrack = async (track: Track) => {
    try {
      Alert.alert(
        'Download Track',
        `Download "${track.title}" for offline playback?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download',
            onPress: async () => {
              console.log(`🔽 Starting download for track: ${track.id} - ${track.title}`);
              
              const result = await retreatService.downloadTrack(track.id, (progress) => {
                console.log(`📊 Download progress: ${Math.round(progress)}%`);
              });
              
              console.log(`🔽 Download result:`, result);
              
              if (result.success) {
                setDownloadedTracks(prev => new Set(prev).add(track.id));
                Alert.alert('Download Complete', 'Track has been downloaded for offline playback.');
              } else {
                Alert.alert('Download Failed', result.error || 'Failed to download track.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download track.');
    }
  };

  const handleRemoveDownload = async (track: Track) => {
    try {
      Alert.alert(
        'Remove Download',
        `Remove downloaded file for "${track.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              const result = await retreatService.removeDownloadedTrack(track.id);
              if (result.success) {
                setDownloadedTracks(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(track.id);
                  return newSet;
                });
                Alert.alert('Removed', 'Downloaded file has been removed.');
              } else {
                Alert.alert('Error', result.error || 'Failed to remove download.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Remove download error:', error);
      Alert.alert('Error', 'Failed to remove download.');
    }
  };

  const handleDownloadAllSession = async () => {
    try {
      if (!session || !allTracks.length) return;
      
      Alert.alert(
        'Download Session',
        `Download all ${allTracks.length} tracks from "${session.name}" for offline playback?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download All',
            onPress: async () => {
              console.log(`🔽 Starting bulk download for session: ${session.name}`);
              
              let successCount = 0;
              let failCount = 0;
              
              for (let i = 0; i < allTracks.length; i++) {
                const track = allTracks[i];
                console.log(`📊 Downloading track ${i + 1}/${allTracks.length}: ${track.title}`);
                
                const result = await retreatService.downloadTrack(track.id);
                
                if (result.success) {
                  successCount++;
                  setDownloadedTracks(prev => new Set(prev).add(track.id));
                } else {
                  failCount++;
                  console.error(`Failed to download track ${track.title}:`, result.error);
                }
              }
              
              if (successCount === allTracks.length) {
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
      console.error('Bulk download error:', error);
      Alert.alert('Error', 'Failed to download session.');
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
          <Text style={styles.headerTitle}>{session.name}</Text>
          <Text style={styles.headerSubtitle}>
            {session.gathering.name} • {new Date(session.date).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Track Player */}
        {currentTrack && (
          <AudioPlayer
            track={currentTrack}
            onProgressUpdate={handleProgressUpdate}
            onTrackComplete={handleTrackComplete}
            onNextTrack={currentTrackIndex < allTracks.length - 1 ? goToNextTrack : undefined}
            onPreviousTrack={currentTrackIndex > 0 ? goToPreviousTrack : undefined}
          />
        )}

        {/* Session Actions */}
        <View style={styles.sessionActions}>
          <TouchableOpacity
            onPress={handleDownloadAllSession}
            style={styles.downloadAllButton}
          >
            <Ionicons name="download" size={20} color="white" />
            <Text style={styles.downloadAllButtonText}>Download Session ({allTracks.length} tracks)</Text>
          </TouchableOpacity>
        </View>

        {/* Tracks List */}
        <View style={styles.tracksList}>
          <Text style={styles.tracksTitle}>
            Tracks ({allTracks.length})
          </Text>
          
          {allTracks.map((track, trackIndex) => {
            const isCurrentTrack = trackIndex === currentTrackIndex;
            
            return (
              <TouchableOpacity
                key={track.id}
                onPress={() => selectTrack(trackIndex)}
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
                    <View style={styles.trackActions}>
                      {downloadedTracks.has(track.id) ? (
                        <TouchableOpacity
                          onPress={() => handleRemoveDownload(track)}
                          style={styles.downloadedButton}
                        >
                          <Ionicons name="checkmark-circle" size={14} color={colors.saffron[500]} />
                          <Text style={styles.downloadedButtonText}>Downloaded</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleDownloadTrack(track)}
                          style={styles.downloadButton}
                        >
                          <Ionicons name="download-outline" size={14} color={colors.gray[600]} />
                          <Text style={styles.downloadButtonText}>Download</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
  sessionActions: {
    padding: 16,
    paddingTop: 8,
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
  tracksList: {
    padding: 16,
  },
  tracksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 16,
  },
  trackItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  trackActions: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  downloadButtonText: {
    fontSize: 12,
    color: colors.gray[600],
    marginLeft: 4,
    fontWeight: '600',
  },
  downloadedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.saffron[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  downloadedButtonText: {
    fontSize: 12,
    color: colors.saffron[500],
    marginLeft: 4,
    fontWeight: '600',
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