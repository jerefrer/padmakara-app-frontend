import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import retreatService from '@/services/retreatService';
import { Session } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes, estimateAudioFileSize } from '@/utils/fileSize';

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
  const [downloadedTracks, setDownloadedTracks] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());
  const [downloadingTracks, setDownloadingTracks] = useState<Set<string>>(new Set());
  const [isDownloadingRetreat, setIsDownloadingRetreat] = useState(false);
  const [retreatDownloadProgress, setRetreatDownloadProgress] = useState({ completed: 0, total: 0, downloadedSize: 0, totalSize: 0 });
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const [downloadStateLoaded, setDownloadStateLoaded] = useState(false);
  
  // Confirmation states for double-click removal
  const [retreatRemovalConfirmation, setRetreatRemovalConfirmation] = useState(false);
  const removalTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadRetreatDetails();
  }, [id]);
  
  useEffect(() => {
    if (retreat) {
      loadDownloadedTracks();
    }
  }, [retreat]);

  // Refresh download state when screen comes into focus (but not on initial load)
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (retreat && hasMountedRef.current) {
        loadDownloadedTracks();
      }
      hasMountedRef.current = true;
    }, [retreat])
  );

  // Smooth transition when button state changes
  useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: 0.7,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [downloadedTracks.size, isDownloadingRetreat]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (removalTimeoutRef.current) {
        clearTimeout(removalTimeoutRef.current);
      }
    };
  }, []);

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

  const loadDownloadedTracks = async () => {
    try {
      if (retreat?.sessions) {
        const downloadedTrackIds = new Set<string>();
        
        // Collect all tracks from all sessions
        const allTracks: any[] = [];
        retreat.sessions.forEach(session => {
          if (session.tracks) {
            allTracks.push(...session.tracks);
          }
        });
        
        // Check all tracks simultaneously for faster loading
        const downloadPromises = allTracks.map(async (track) => {
          const isDownloaded = await retreatService.isTrackDownloaded(track.id);
          return { trackId: track.id, isDownloaded };
        });
        
        const results = await Promise.all(downloadPromises);
        results.forEach(({ trackId, isDownloaded }) => {
          if (isDownloaded) {
            downloadedTrackIds.add(trackId);
          }
        });
        
        setDownloadedTracks(downloadedTrackIds);
        setDownloadStateLoaded(true);
        console.log(`📥 Found ${downloadedTrackIds.size} downloaded tracks in retreat`);
      }
    } catch (error) {
      console.error('Load downloaded tracks error:', error);
      setDownloadStateLoaded(true); // Set loaded even on error to prevent infinite loading
    }
  };

  // Helper function for confirmation system
  const resetRetreatRemovalConfirmation = () => {
    setRetreatRemovalConfirmation(false);
    if (removalTimeoutRef.current) {
      clearTimeout(removalTimeoutRef.current);
    }
  };

  const handleSessionPress = (sessionId: string) => {
    router.push(`/session/${sessionId}`);
  };

  const calculateSessionSize = (session: Session) => {
    if (!session.tracks) return 0;
    return session.tracks.reduce((total, track) => {
      return total + (track.file_size || estimateAudioFileSize(track.duration));
    }, 0);
  };

  const calculateTotalRetreatSize = (sessions: Session[]) => {
    return sessions.reduce((total, session) => {
      return total + calculateSessionSize(session);
    }, 0);
  };

  const formatSessionInfo = (session: Session) => {
    const tracksCount = session.tracks?.length || 0;
    const sessionSize = formatBytes(calculateSessionSize(session));
    return `${tracksCount} tracks • ${t(`retreats.${session.type}`)} • ${sessionSize}`;
  };

  const handleDownloadAllRetreat = async () => {
    try {
      if (!retreat) return;
      
      // Check if already downloading retreat
      if (isDownloadingRetreat) {
        // Cancel all active downloads
        for (const trackId of downloadingTracks) {
          await retreatService.cancelTrackDownload(trackId);
        }
        
        // Reset state
        setIsDownloadingRetreat(false);
        setRetreatDownloadProgress({ completed: 0, total: 0, downloadedSize: 0, totalSize: 0 });
        setDownloadingTracks(new Set());
        setDownloadProgress(new Map());
        return;
      }

      // Get all tracks from all sessions
      const allTracks: any[] = [];
      retreat.sessions.forEach(session => {
        if (session.tracks) {
          allTracks.push(...session.tracks);
        }
      });
      
      if (allTracks.length === 0) {
        Alert.alert('No Tracks', 'This retreat has no tracks to download.');
        return;
      }
      
      // Check if all tracks are downloaded - if so, remove them
      const tracksToDownload = allTracks.filter(track => !downloadedTracks.has(track.id));
      const tracksToRemove = allTracks.filter(track => downloadedTracks.has(track.id));
      
      if (tracksToDownload.length === 0 && tracksToRemove.length > 0) {
        // All tracks are downloaded - handle removal with double-click confirmation
        if (retreatRemovalConfirmation) {
          // Second click - execute removal
          console.log(`🗑️ Removing all downloads for retreat: ${retreat.name}`);
          resetRetreatRemovalConfirmation();
          
          for (const track of tracksToRemove) {
            const result = await retreatService.removeDownloadedTrack(track.id);
            if (result.success) {
              setDownloadedTracks(prev => {
                const newSet = new Set(prev);
                newSet.delete(track.id);
                return newSet;
              });
              console.log(`✅ Removed download: ${track.title}`);
            }
          }
          
          console.log(`🎉 All retreat downloads removed`);
          return;
        } else {
          // First click - enter confirmation state
          setRetreatRemovalConfirmation(true);
          removalTimeoutRef.current = setTimeout(() => {
            setRetreatRemovalConfirmation(false);
          }, 4000);
          return;
        }
      }
      
      if (tracksToDownload.length === 0) {
        console.log(`✅ All tracks already downloaded`);
        return;
      }

      console.log(`🔽 Starting bulk download for retreat: ${retreat.name}`);
      
      setIsDownloadingRetreat(true);
      const totalSize = tracksToDownload.reduce((sum, track) => 
        sum + (track.file_size || estimateAudioFileSize(track.duration)), 0);
      setRetreatDownloadProgress({ completed: 0, total: tracksToDownload.length, downloadedSize: 0, totalSize });
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < tracksToDownload.length; i++) {
        const track = tracksToDownload[i];
        console.log(`📊 Downloading track ${i + 1}/${tracksToDownload.length}: ${track.title}`);
        
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
        
        // Update retreat progress
        const downloadedSize = tracksToDownload.slice(0, i + 1).reduce((sum, track) => 
          sum + (track.file_size || estimateAudioFileSize(track.duration)), 0);
        setRetreatDownloadProgress({ 
          completed: i + 1, 
          total: tracksToDownload.length,
          downloadedSize,
          totalSize
        });
      }
      
      setIsDownloadingRetreat(false);
      setRetreatDownloadProgress({ completed: 0, total: 0, downloadedSize: 0, totalSize: 0 });
      
      console.log(`🎉 Retreat download completed: ${successCount} succeeded, ${failCount} failed`);
      
    } catch (error) {
      setIsDownloadingRetreat(false);
      setRetreatDownloadProgress({ completed: 0, total: 0, downloadedSize: 0, totalSize: 0 });
      console.error('Bulk retreat download error:', error);
    }
  };

  if (loading || !downloadStateLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>
            {loading ? 'Loading retreat...' : 'Loading download status...'}
          </Text>
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
          <Animated.View style={{ opacity: buttonOpacity }}>
            <TouchableOpacity
              onPress={handleDownloadAllRetreat}
              style={[
                (() => {
                  const allTracks: any[] = [];
                  retreat.sessions.forEach(session => {
                    if (session.tracks) {
                      allTracks.push(...session.tracks);
                    }
                  });
                  const tracksToDownload = allTracks.filter(t => !downloadedTracks.has(t.id));
                  const tracksDownloaded = allTracks.filter(t => downloadedTracks.has(t.id));
                  const allDownloaded = tracksToDownload.length === 0 && tracksDownloaded.length > 0;
                  
                  if (isDownloadingRetreat) {
                    return styles.downloadAllButtonActive;
                  } else if (allDownloaded && retreatRemovalConfirmation) {
                    return styles.confirmRemovalButton;
                  } else if (allDownloaded) {
                    return styles.removeAllButton;
                  } else {
                    return styles.downloadAllButton;
                  }
                })()
              ]}
            >
            {isDownloadingRetreat ? (
              <>
                <ActivityIndicator size="small" color="white" style={styles.downloadSpinner} />
                <View style={styles.downloadProgressContainer}>
                  <Text style={styles.downloadAllButtonText}>
                    {retreatDownloadProgress.total > 0 
                      ? `${Math.round((retreatDownloadProgress.completed / retreatDownloadProgress.total) * 100)}%`
                      : 'Preparing...'
                    }
                  </Text>
                  {retreatDownloadProgress.totalSize > 0 && (
                    <Text style={styles.downloadSizeText}>
                      {formatBytes(retreatDownloadProgress.downloadedSize)} / {formatBytes(retreatDownloadProgress.totalSize)}
                    </Text>
                  )}
                </View>
              </>
            ) : (() => {
              const allTracks: any[] = [];
              retreat.sessions.forEach(session => {
                if (session.tracks) {
                  allTracks.push(...session.tracks);
                }
              });
              const tracksToDownload = allTracks.filter(t => !downloadedTracks.has(t.id));
              const tracksDownloaded = allTracks.filter(t => downloadedTracks.has(t.id));
              const allDownloaded = tracksToDownload.length === 0 && tracksDownloaded.length > 0;
              
              const totalSizeToDownload = formatBytes(tracksToDownload.reduce((total, track) => 
                total + (track.file_size || estimateAudioFileSize(track.duration)), 0));
              const totalSizeDownloaded = formatBytes(tracksDownloaded.reduce((total, track) => 
                total + (track.file_size || estimateAudioFileSize(track.duration)), 0));
              
              // Handle confirmation state for removal
              if (allDownloaded && retreatRemovalConfirmation) {
                return (
                  <>
                    <Ionicons name="warning" size={20} color={colors.saffron[500]} />
                    <Text style={styles.confirmRemovalButtonText}>
                      Tap again to confirm removal
                    </Text>
                  </>
                );
              }
              
              return (
                <>
                  <Ionicons 
                    name={allDownloaded ? "trash-outline" : "download"} 
                    size={20} 
                    color={allDownloaded ? colors.gray[600] : "white"} 
                  />
                  <Text style={allDownloaded ? styles.removeAllButtonText : styles.downloadAllButtonText}>
                    {allDownloaded 
                      ? `Remove Downloads (${tracksDownloaded.length} tracks, ${totalSizeDownloaded})`
                      : `Download Retreat (${tracksToDownload.length} tracks, ${totalSizeToDownload})`
                    }
                  </Text>
                </>
              );
            })()}
            </TouchableOpacity>
          </Animated.View>
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
                      {formatSessionInfo(session)}
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
  downloadAllButtonActive: {
    backgroundColor: colors.burgundy[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    opacity: 0.9,
  },
  removeAllButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.gray[300],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  removeAllButtonText: {
    color: colors.gray[600],
    fontSize: 16,
    fontWeight: '600',
  },
  downloadSpinner: {
    marginRight: 8,
  },
  downloadProgressContainer: {
    alignItems: 'center',
  },
  downloadSizeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  confirmRemovalButton: {
    backgroundColor: colors.saffron[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.saffron[500],
  },
  confirmRemovalButtonText: {
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