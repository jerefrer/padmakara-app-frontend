import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AudioPlayer } from '@/components/AudioPlayer';
import { CircularProgressButton } from '@/components/CircularProgressButton';
import { AnimatedPlayingBars } from '@/components/AnimatedPlayingBars';
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
  white: '#ffffff',
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
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadedTracks, setDownloadedTracks] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());
  const [downloadingTracks, setDownloadingTracks] = useState<Set<string>>(new Set());
  const [isDownloadingSession, setIsDownloadingSession] = useState(false);
  const [sessionDownloadProgress, setSessionDownloadProgress] = useState({ completed: 0, total: 0 });
  const sessionDownloadCancelRef = useRef(false);

  useEffect(() => {
    loadSessionDetails();
  }, [id]);
  
  useEffect(() => {
    if (session) {
      loadDownloadedTracks();
    }
  }, [session]);

  // Simple progress update handler
  const handleProgressUpdate = (progress: UserProgress) => {
    // In production, this would sync with your backend
    console.log('Progress updated:', progress);
  };

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
  
  // Track selection - simple state update
  const selectTrack = (track: Track, trackIndex: number) => {
    setCurrentTrack(track);
    setCurrentTrackIndex(trackIndex);
  };


  const handleDownloadTrack = async (track: Track) => {
    try {
      // Check if already downloading
      if (downloadingTracks.has(track.id)) {
        // Cancel download
        const cancelled = await retreatService.cancelTrackDownload(track.id);
        if (cancelled) {
          setDownloadingTracks(prev => {
            const newSet = new Set(prev);
            newSet.delete(track.id);
            return newSet;
          });
          setDownloadProgress(prev => {
            const newMap = new Map(prev);
            newMap.delete(track.id);
            return newMap;
          });
        }
        return;
      }

      console.log(`🔽 Starting download for track: ${track.id} - ${track.title}`);
      
      // Mark as downloading
      setDownloadingTracks(prev => new Set(prev).add(track.id));
      setDownloadProgress(prev => new Map(prev).set(track.id, 0));
      
      const result = await retreatService.downloadTrack(track.id, (progress) => {
        console.log(`📊 Download progress: ${Math.round(progress)}%`);
        setDownloadProgress(prev => new Map(prev).set(track.id, progress));
      });
      
      console.log(`🔽 Download result:`, result);
      
      // Clean up downloading state
      setDownloadingTracks(prev => {
        const newSet = new Set(prev);
        newSet.delete(track.id);
        return newSet;
      });
      setDownloadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(track.id);
        return newMap;
      });
      
      if (result.success) {
        setDownloadedTracks(prev => new Set(prev).add(track.id));
        console.log(`✅ Track download completed: ${track.title}`);
      } else if (result.cancelled) {
        console.log(`⏸️ Track download cancelled: ${track.title}`);
      } else {
        console.error(`❌ Download failed: ${result.error}`);
      }
    } catch (error) {
      // Clean up on error
      setDownloadingTracks(prev => {
        const newSet = new Set(prev);
        newSet.delete(track.id);
        return newSet;
      });
      setDownloadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(track.id);
        return newMap;
      });
      
      console.error('Download error:', error);
    }
  };

  const handleRemoveDownload = async (track: Track) => {
    try {
      console.log(`🗑️ Removing download for track: ${track.id} - ${track.title}`);
      
      const result = await retreatService.removeDownloadedTrack(track.id);
      if (result.success) {
        setDownloadedTracks(prev => {
          const newSet = new Set(prev);
          newSet.delete(track.id);
          return newSet;
        });
        console.log(`✅ Download removed: ${track.title}`);
      } else {
        console.error(`❌ Failed to remove download: ${result.error}`);
      }
    } catch (error) {
      console.error('Remove download error:', error);
    }
  };

  const handleDownloadAllSession = async () => {
    try {
      if (!session || !allTracks.length) return;
      
      // Check if already downloading session
      if (isDownloadingSession) {
        // Cancel all active downloads
        for (const trackId of downloadingTracks) {
          await retreatService.cancelTrackDownload(trackId);
        }
        
        // Reset state
        sessionDownloadCancelRef.current = true;
        setIsDownloadingSession(false);
        setSessionDownloadProgress({ completed: 0, total: 0 });
        setDownloadingTracks(new Set());
        setDownloadProgress(new Map());
        return;
      }

      console.log(`🔽 Starting bulk download for session: ${session.name}`);
      
      // Filter out already downloaded tracks
      const tracksToDownload = allTracks.filter(track => !downloadedTracks.has(track.id));
      
      if (tracksToDownload.length === 0) {
        console.log(`✅ All tracks already downloaded`);
        return;
      }
      
      sessionDownloadCancelRef.current = false;
      setIsDownloadingSession(true);
      setSessionDownloadProgress({ completed: 0, total: tracksToDownload.length });
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < tracksToDownload.length; i++) {
        const track = tracksToDownload[i];
        console.log(`📊 Downloading track ${i + 1}/${tracksToDownload.length}: ${track.title}`);
        
        // Check if session download was cancelled before starting next track
        if (sessionDownloadCancelRef.current) {
          console.log('🚫 Session download cancelled, stopping');
          break;
        }
        
        // Mark track as downloading
        setDownloadingTracks(prev => new Set(prev).add(track.id));
        
        const result = await retreatService.downloadTrack(track.id, (progress) => {
          setDownloadProgress(prev => new Map(prev).set(track.id, progress));
        });
        
        // Clean up track downloading state
        setDownloadingTracks(prev => {
          const newSet = new Set(prev);
          newSet.delete(track.id);
          return newSet;
        });
        setDownloadProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(track.id);
          return newMap;
        });
        
        if (result.success && !result.cancelled) {
          successCount++;
          setDownloadedTracks(prev => new Set(prev).add(track.id));
          console.log(`✅ Track downloaded: ${track.title} (${successCount}/${tracksToDownload.length})`);
        } else if (result.cancelled) {
          console.log(`⏸️ Track download cancelled: ${track.title}`);
          break; // Exit the loop if download was cancelled
        } else {
          failCount++;
          console.error(`❌ Failed to download track ${track.title}:`, result.error);
        }
        
        // Update session progress
        setSessionDownloadProgress({ completed: i + 1, total: tracksToDownload.length });
      }
      
      setIsDownloadingSession(false);
      setSessionDownloadProgress({ completed: 0, total: 0 });
      
      console.log(`🎉 Session download completed: ${successCount} succeeded, ${failCount} failed`);
      
    } catch (error) {
      setIsDownloadingSession(false);
      setSessionDownloadProgress({ completed: 0, total: 0 });
      console.error('Bulk download error:', error);
    }
  };

  const goToNextTrack = () => {
    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < allTracks.length) {
      const nextTrack = allTracks[nextIndex];
      selectTrack(nextTrack, nextIndex);
    }
  };

  const goToPreviousTrack = () => {
    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      const prevTrack = allTracks[prevIndex];
      selectTrack(prevTrack, prevIndex);
    }
  };

  const handleTrackComplete = () => {
    // Auto-advance to next track
    if (currentTrackIndex < allTracks.length - 1) {
      goToNextTrack();
    } else {
      Alert.alert('Session Complete', 'You have finished all tracks in this session!');
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

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Session Actions */}
        <View style={styles.sessionActions}>
          <TouchableOpacity
            onPress={handleDownloadAllSession}
            style={[
              styles.downloadAllButton,
              isDownloadingSession && styles.downloadAllButtonActive
            ]}
          >
            {isDownloadingSession ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.downloadAllButtonText}>
                  {sessionDownloadProgress.total > 0 
                    ? `Downloading (${sessionDownloadProgress.completed}/${sessionDownloadProgress.total})`
                    : 'Preparing...'
                  }
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="download" size={20} color="white" />
                <Text style={styles.downloadAllButtonText}>
                  Download Session ({allTracks.filter(t => !downloadedTracks.has(t.id)).length} tracks)
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tracks List */}
        <View style={styles.tracksList}>
          <Text style={styles.tracksTitle}>
            Tracks ({allTracks.length})
          </Text>
          
          {allTracks.map((track, trackIndex) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            
            return (
              <TouchableOpacity
                key={track.id}
                onPress={() => selectTrack(track, trackIndex)}
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
                  <Text style={styles.trackDuration}>
                    {formatDuration(track.duration)}
                  </Text>
                </View>
                
                <View style={styles.trackRightSection}>
                  {isCurrentTrack && (
                    <View style={styles.playingIndicator}>
                      <AnimatedPlayingBars 
                        isPlaying={isTrackPlaying}
                        size={20} 
                        color={colors.burgundy[500]} 
                      />
                    </View>
                  )}
                  
                  {downloadedTracks.has(track.id) ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveDownload(track)}
                      style={styles.downloadedIconButton}
                    >
                      <Ionicons name="checkmark-circle" size={24} color={colors.saffron[500]} />
                    </TouchableOpacity>
                  ) : downloadingTracks.has(track.id) ? (
                    <TouchableOpacity
                      onPress={() => handleDownloadTrack(track)}
                      style={styles.downloadingIconButton}
                    >
                      <CircularProgressButton
                        progress={downloadProgress.get(track.id) || 0}
                        isActive={true}
                        onPress={() => handleDownloadTrack(track)}
                        size={24}
                        strokeWidth={2}
                        icon="download-outline"
                        style={styles.downloadProgress}
                      />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleDownloadTrack(track)}
                      style={styles.downloadIconButton}
                    >
                      <Ionicons name="download-outline" size={18} color={colors.white} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      
      {/* Bottom-sticky Audio Player */}
      <AudioPlayer
        track={currentTrack}
        onProgressUpdate={handleProgressUpdate}
        onTrackComplete={handleTrackComplete}
        onNextTrack={currentTrackIndex < allTracks.length - 1 ? goToNextTrack : undefined}
        onPreviousTrack={currentTrackIndex > 0 ? goToPreviousTrack : undefined}
        onPlayingStateChange={setIsTrackPlaying}
      />
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
  scrollContent: {
    paddingBottom: 80, // Space for bottom player
  },
  sessionActions: {
    padding: 16,
    paddingTop: 24,
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
  downloadAllButtonActive: {
    backgroundColor: colors.burgundy[600],
    opacity: 0.9,
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
    justifyContent: 'center',
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
  trackRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.burgundy[500],
    borderRadius: 18,
    width: 36,
    height: 36,
  },
  downloadingIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 18,
    width: 36,
    height: 36,
  },
  downloadedIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 18,
    width: 36,
    height: 36,
  },
  downloadProgress: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 20,
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