import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AudioPlayer } from '@/components/AudioPlayer';
import { AnimatedPlayingBars } from '@/components/AnimatedPlayingBars';
import retreatService from '@/services/retreatService';
import downloadService from '@/services/downloadService';
import { ConfirmationModal, ConfirmationButton } from '@/components/ConfirmationModal';
import { OfflineBadge } from '@/components/OfflineBadge';
import { Session, Track, UserProgress } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslatedName } from '@/utils/i18n';
import { formatBytes, estimateAudioFileSize } from '@/utils/fileSize';
import { API_ENDPOINTS } from '@/services/apiConfig';
import apiService from '@/services/apiService';
import downloadStateService, { DownloadState } from '@/services/downloadStateService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface RetreatDetails {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  season: string;
  year: number;
  startDate: string;
  endDate: string;
  sessions: Session[];
  retreat_group: {
    id: string;
    name: string;
    name_translations?: Record<string, string>;
  };
}

// Flat track with session info for display
interface TrackWithSession extends Track {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionType: string;
}

export default function RetreatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, contentLanguage, language } = useLanguage();
  const [retreat, setRetreat] = useState<RetreatDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [allTracks, setAllTracks] = useState<TrackWithSession[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<TrackWithSession[]>([]);
  const [currentLanguageMode, setCurrentLanguageMode] = useState<string>('en');

  // Overflow menu state
  const [menuVisible, setMenuVisible] = useState(false);

  // Download for offline state
  const [isRetreatDownloaded, setIsRetreatDownloaded] = useState(false);
  const [isDownloadingRetreat, setIsDownloadingRetreat] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, startTime: 0 });

  // ZIP download state (for downloading to computer)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipDownloadProgress, setZipDownloadProgress] = useState<string>('');
  const [currentDownloadRequestId, setCurrentDownloadRequestId] = useState<string | null>(null);

  // Pending download confirmation (triggers download in useEffect)
  const [pendingDownloadConfirm, setPendingDownloadConfirm] = useState(false);

  // Confirmation modal state
  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: ConfirmationButton[];
    icon?: keyof typeof Ionicons.glyphMap;
  }>({ visible: false, title: '', message: '', buttons: [] });

  const showModal = (
    title: string,
    message: string,
    buttons: ConfirmationButton[] = [{ text: 'OK' }],
    icon?: keyof typeof Ionicons.glyphMap
  ) => {
    setModalState({ visible: true, title, message, buttons, icon });
  };

  const hideModal = () => {
    setModalState(prev => ({ ...prev, visible: false }));
  };

  // Build flat list of tracks with session info
  const buildTracksListWithSessions = useCallback(() => {
    if (!retreat?.sessions) {
      return;
    }

    const tracks: TrackWithSession[] = [];

    // Sort sessions by date
    const sortedSessions = [...retreat.sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const session of sortedSessions) {
      if (session.tracks) {
        const sortedTracks = [...session.tracks].sort((a, b) => a.order - b.order);
        for (const track of sortedTracks) {
          tracks.push({
            ...track,
            sessionId: session.id,
            sessionName: session.name,
            sessionDate: session.date,
            sessionType: session.type,
          });
        }
      }
    }

    setAllTracks(tracks);
  }, [retreat]);

  // Apply language filter to tracks
  const applyLanguageFilter = useCallback(() => {
    if (allTracks.length === 0) {
      setFilteredTracks([]);
      return;
    }

    let filtered: TrackWithSession[];

    // Check if tracks have language metadata
    const hasLanguageMetadata = allTracks.some(track => track.isOriginal !== undefined || track.language);

    if (!hasLanguageMetadata) {
      // No language metadata - show all tracks
      filtered = allTracks;
    } else if (currentLanguageMode === 'en') {
      // English only - show original tracks (or those without explicit language info)
      filtered = allTracks.filter(track => track.isOriginal !== false);
    } else if (currentLanguageMode === 'en-pt') {
      // Both - show all tracks
      filtered = allTracks;
    } else if (currentLanguageMode === 'pt') {
      // Portuguese only - show translation tracks
      filtered = allTracks.filter(track => !track.isOriginal && track.language === 'pt');
      // If no PT tracks, fall back to all
      if (filtered.length === 0) filtered = allTracks;
    } else {
      filtered = allTracks;
    }

    setFilteredTracks(filtered);
  }, [allTracks, currentLanguageMode]);

  useEffect(() => {
    loadRetreatDetails();
  }, [id]);

  useEffect(() => {
    if (retreat) {
      checkDownloadStatus();
      buildTracksListWithSessions();
    }
  }, [retreat, buildTracksListWithSessions]);

  // Apply language filter when language mode or tracks change
  useEffect(() => {
    if (allTracks.length > 0) {
      applyLanguageFilter();
    }
  }, [allTracks, currentLanguageMode, applyLanguageFilter]);

  // Track download completion to prevent stale callbacks
  const downloadCompletedRef = useRef(false);

  // Refresh download status when screen comes into focus
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (retreat && hasMountedRef.current) {
        checkDownloadStatus();
        const downloadingRetreatId = downloadService.getDownloadingRetreatId();
        if (downloadingRetreatId !== id && isDownloadingRetreat) {
          setIsDownloadingRetreat(false);
          setDownloadProgress({ current: 0, total: 0, startTime: 0 });
        }
      }
      hasMountedRef.current = true;
    }, [retreat, id, isDownloadingRetreat])
  );

  // Subscribe to download progress if a download is in progress for this retreat
  useEffect(() => {
    const downloadingRetreatId = downloadService.getDownloadingRetreatId();
    if (downloadingRetreatId === id) {
      setIsDownloadingRetreat(true);
      const progress = downloadService.getDownloadProgress();
      if (progress) {
        setDownloadProgress({
          current: progress.current,
          total: progress.total,
          startTime: progress.startTime,
        });
      }

      const unsubscribe = downloadService.subscribeToProgress((progress) => {
        setDownloadProgress({
          current: progress.current,
          total: progress.total,
          startTime: progress.startTime,
        });
      });

      return unsubscribe;
    }
  }, [id]);

  // Handle pending download confirmation
  useEffect(() => {
    if (!pendingDownloadConfirm || !retreat) return;

    setPendingDownloadConfirm(false);
    downloadCompletedRef.current = false;

    const startDownload = async () => {
      const tracks = getAllTracksForDownload();
      const startTime = Date.now();

      setIsDownloadingRetreat(true);
      setDownloadProgress({ current: 0, total: tracks.length, startTime });

      const unsubscribe = downloadService.subscribeToProgress((progress) => {
        if (downloadCompletedRef.current) return;
        setDownloadProgress({
          current: progress.current,
          total: progress.total,
          startTime: progress.startTime,
        });
      });

      try {
        const result = await downloadService.downloadRetreat(
          retreat.id,
          retreat.name,
          tracks,
          (current, total) => {
            if (downloadCompletedRef.current) return;
            setDownloadProgress({ current, total, startTime });
          }
        );

        downloadCompletedRef.current = true;
        unsubscribe();

        setIsDownloadingRetreat(false);
        setDownloadProgress({ current: 0, total: 0, startTime: 0 });

        if (result.success) {
          setIsRetreatDownloaded(true);
        } else if (result.cancelled) {
          console.log('Download cancelled');
        } else {
          showModal(
            'Download Failed',
            result.error || 'Failed to download retreat',
            [{ text: 'OK' }],
            'alert-circle-outline'
          );
        }
      } catch (error) {
        downloadCompletedRef.current = true;
        unsubscribe();
        setIsDownloadingRetreat(false);
        setDownloadProgress({ current: 0, total: 0, startTime: 0 });
        console.error('Download error:', error);
        showModal(
          'Download Failed',
          'An unexpected error occurred',
          [{ text: 'OK' }],
          'alert-circle-outline'
        );
      }
    };

    startDownload();
  }, [pendingDownloadConfirm, retreat]);

  const loadRetreatDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load language preference
      let initialLanguageMode = 'en';
      try {
        const retreatLanguageKey = `retreat_language_${id}`;
        const storedLanguage = await AsyncStorage.getItem(retreatLanguageKey);
        if (storedLanguage && ['en', 'en-pt', 'pt'].includes(storedLanguage)) {
          initialLanguageMode = storedLanguage;
        } else {
          initialLanguageMode = contentLanguage || 'en';
        }
      } catch (storageError) {
        initialLanguageMode = contentLanguage || 'en';
      }
      setCurrentLanguageMode(initialLanguageMode);

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

  const checkDownloadStatus = async () => {
    if (!retreat) return;
    const downloaded = await downloadService.isRetreatDownloaded(retreat.id);
    setIsRetreatDownloaded(downloaded);
  };

  // Language toggle
  const updateLanguagePreference = async (newLanguageMode: string) => {
    if (!retreat) return;
    try {
      const retreatLanguageKey = `retreat_language_${id}`;
      await AsyncStorage.setItem(retreatLanguageKey, newLanguageMode);
      setCurrentLanguageMode(newLanguageMode);
    } catch (error) {
      console.error('Failed to save language preference:', error);
      setCurrentLanguageMode(newLanguageMode);
    }
  };

  const toggleLanguageMode = () => {
    let newMode: string;
    switch (currentLanguageMode) {
      case 'en':
        newMode = 'en-pt';
        break;
      case 'en-pt':
        newMode = 'pt';
        break;
      case 'pt':
        newMode = 'en';
        break;
      default:
        newMode = 'en';
    }
    updateLanguagePreference(newMode);
  };

  const getLanguageLabel = (languageMode?: string) => {
    switch (languageMode) {
      case 'en': return t('profile.englishOnly') || 'English Only';
      case 'en-pt': return t('profile.englishPortuguese') || 'English + Portuguese';
      case 'pt': return t('profile.portugueseOnly') || 'Portuguese Only';
      default: return t('profile.englishOnly') || 'English Only';
    }
  };

  // Track selection
  const selectTrack = (track: TrackWithSession, trackIndex: number) => {
    setCurrentTrack(track);
    setCurrentTrackIndex(trackIndex);
  };

  const goToNextTrack = () => {
    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < filteredTracks.length) {
      selectTrack(filteredTracks[nextIndex], nextIndex);
    }
  };

  const goToPreviousTrack = () => {
    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      selectTrack(filteredTracks[prevIndex], prevIndex);
    }
  };

  const handleTrackComplete = () => {
    if (currentTrackIndex < filteredTracks.length - 1) {
      goToNextTrack();
    } else {
      Alert.alert(
        t('session.sessionComplete') || 'Retreat Complete',
        t('session.sessionCompleteMessage') || 'You have finished all tracks in this retreat!'
      );
    }
  };

  const handleProgressUpdate = (progress: UserProgress) => {
    console.log('Progress updated:', progress);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  // Format session date header - "Day N · March 2nd · Morning"
  const formatSessionHeader = (session: { sessionName: string; sessionDate: string; sessionType: string }) => {
    const sessionDate = new Date(session.sessionDate);
    const retreatStartDate = retreat ? new Date(retreat.startDate) : sessionDate;

    // Calculate day number (1-based)
    const diffTime = sessionDate.getTime() - retreatStartDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const dayNumber = diffDays + 1;

    // Format month and day with ordinal
    const month = sessionDate.toLocaleDateString('en-US', { month: 'long' });
    const dayNum = sessionDate.getDate();
    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const sessionType = t(`retreats.${session.sessionType}`) || session.sessionType;
    return `Day ${dayNumber} · ${month} ${getOrdinal(dayNum)} · ${sessionType}`;
  };

  const calculateTotalRetreatSize = () => {
    if (!retreat) return 0;
    return retreat.sessions.reduce((total, session) => {
      return total + (session.tracks?.reduce((sessionTotal, track) => {
        return sessionTotal + (track.file_size || estimateAudioFileSize(track.duration));
      }, 0) || 0);
    }, 0);
  };

  const getAllTracksForDownload = (): Array<{ id: string; title: string }> => {
    if (!retreat) return [];
    const tracks: Array<{ id: string; title: string }> = [];
    retreat.sessions.forEach(session => {
      if (session.tracks) {
        session.tracks.forEach(track => {
          tracks.push({ id: track.id, title: track.title });
        });
      }
    });
    return tracks;
  };

  // Handle download for offline
  const handleDownloadForOffline = async () => {
    if (!retreat) return;
    setMenuVisible(false);

    if (isRetreatDownloaded) {
      showModal(
        'Remove Download',
        `Remove "${getTranslatedName(retreat, language)}" from offline storage?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              const result = await downloadService.removeDownloadedRetreat(retreat.id);
              if (result.success) {
                setIsRetreatDownloaded(false);
              }
            },
          },
        ],
        'cloud-offline-outline'
      );
      return;
    }

    const tracks = getAllTracksForDownload();
    const totalSize = formatBytes(calculateTotalRetreatSize());

    showModal(
      'Download for offline listening',
      `Download all ${tracks.length} tracks (${totalSize}) for offline listening?\n\nThis content won't be automatically removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => {
            setPendingDownloadConfirm(true);
          },
        },
      ],
      'download-outline'
    );
  };

  // Handle ZIP download
  const handleDownloadRetreatZip = async () => {
    if (!retreat) return;
    setMenuVisible(false);

    if (isDownloadingZip) {
      setIsDownloadingZip(false);
      setZipDownloadProgress('');
      await downloadStateService.removeDownloadState(retreat.id);
      return;
    }

    setIsDownloadingZip(true);
    setZipDownloadProgress('Preparing download...');

    try {
      const downloadEndpoint = API_ENDPOINTS.EVENT_DOWNLOAD_REQUEST(retreat.id);
      const requestResponse = await apiService.post(downloadEndpoint);

      if (!requestResponse.success) {
        throw new Error(requestResponse.error || 'Failed to prepare download');
      }

      const requestId = requestResponse.data?.request_id;
      if (!requestId) {
        throw new Error('No request ID received');
      }

      setCurrentDownloadRequestId(requestId);

      const downloadState: DownloadState = {
        requestId,
        retreatId: retreat.id,
        retreatName: retreat.name,
        status: 'pending',
        startedAt: new Date().toISOString(),
        progressMessage: 'Generating ZIP file...'
      };
      await downloadStateService.saveDownloadState(downloadState);
      setZipDownloadProgress('Generating ZIP file...');

      let isComplete = false;
      let attempt = 0;
      const maxAttempts = 240;

      while (!isComplete && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResponse = await apiService.get(API_ENDPOINTS.DOWNLOAD_STATUS(requestId));

        if (!statusResponse.success) {
          throw new Error(statusResponse.error || 'Failed to check ZIP status');
        }

        if (statusResponse.data?.status === 'ready') {
          isComplete = true;
          setZipDownloadProgress('ZIP ready! Starting download...');
        } else if (statusResponse.data?.status === 'failed') {
          throw new Error(statusResponse.data?.error_message || 'ZIP generation failed');
        } else if (statusResponse.data?.status === 'processing') {
          const progressPercent = statusResponse.data.progress_percent;
          const progressMsg = progressPercent !== undefined
            ? `Generating ZIP... ${progressPercent}%`
            : 'Generating ZIP file...';
          setZipDownloadProgress(progressMsg);
        }

        attempt++;
      }

      if (!isComplete) {
        throw new Error('Download preparation timed out');
      }

      const downloadResponse = await apiService.get(API_ENDPOINTS.DOWNLOAD_FILE(requestId));

      if (!downloadResponse.data?.success || !downloadResponse.data?.download_url) {
        throw new Error('Failed to get download URL');
      }

      const { Linking } = require('react-native');
      await Linking.openURL(downloadResponse.data.download_url);

      await downloadStateService.removeDownloadState(retreat.id);

    } catch (error: any) {
      console.error('ZIP download error:', error);
      await downloadStateService.removeDownloadState(retreat?.id || '');
      showModal(
        'Download Error',
        error.message || 'Failed to download ZIP',
        [{ text: 'OK' }],
        'alert-circle-outline'
      );
    } finally {
      setIsDownloadingZip(false);
      setZipDownloadProgress('');
      setCurrentDownloadRequestId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>{t('common.loading') || 'Loading...'}</Text>
        </View>
      </View>
    );
  }

  if (error || !retreat) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('retreats.notFound') || 'Retreat not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonError}>
            <Text style={styles.backButtonText}>{t('common.goBack') || 'Go Back'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Group tracks by session for display with headers
  let currentSessionId: string | null = null;

  return (
    <View style={styles.container}>
      {/* Fixed Header Section */}
      <SafeAreaView edges={['top']} style={styles.fixedHeaderContainer}>
        {/* Navigation Header with Overflow Menu */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>{retreat.retreat_group ? getTranslatedName(retreat.retreat_group, language) : ''}</Text>
              {isRetreatDownloaded && <OfflineBadge />}
            </View>
            <Text style={styles.headerSubtitle}>
              {getTranslatedName(retreat, language)} {retreat.year}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={colors.gray[600]} />
          </TouchableOpacity>
        </View>

        {/* Download Progress Banner */}
        {isDownloadingRetreat && (
          <View style={styles.downloadBanner}>
            <View style={styles.downloadBannerContent}>
              <View style={styles.downloadBannerHeader}>
                <Text style={styles.downloadBannerTitle}>Downloading for offline listening...</Text>
                <TouchableOpacity onPress={() => downloadService.cancelDownload()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color={colors.gray[500]} />
                </TouchableOpacity>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }
                  ]}
                />
              </View>
              <Text style={styles.downloadBannerSubtext}>
                {downloadProgress.current} of {downloadProgress.total} tracks
                {downloadProgress.startTime > 0 && downloadProgress.current > 0 && (() => {
                  const elapsed = (Date.now() - downloadProgress.startTime) / 1000;
                  const perTrack = elapsed / downloadProgress.current;
                  const remaining = (downloadProgress.total - downloadProgress.current) * perTrack;
                  if (remaining < 60) return ` • ~${Math.ceil(remaining)}s remaining`;
                  return ` • ~${Math.ceil(remaining / 60)}m remaining`;
                })()}
              </Text>
            </View>
          </View>
        )}

        {/* ZIP Download Progress Banner */}
        {isDownloadingZip && (
          <View style={styles.downloadBanner}>
            <ActivityIndicator size="small" color={colors.burgundy[500]} />
            <Text style={styles.downloadBannerText}>{zipDownloadProgress}</Text>
            <TouchableOpacity onPress={handleDownloadRetreatZip}>
              <Ionicons name="close" size={20} color={colors.gray[600]} />
            </TouchableOpacity>
          </View>
        )}

        {/* Language Toggle */}
        {currentLanguageMode && (
          <View style={styles.languageSection}>
            <View style={styles.languageToggle}>
              <Text style={styles.languageLabel}>{t('session.tracksLanguage') || 'Tracks Language:'}</Text>
              <TouchableOpacity
                style={styles.languageButton}
                onPress={toggleLanguageMode}
              >
                <Text style={styles.languageButtonText}>
                  {getLanguageLabel(currentLanguageMode)}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.gray[600]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

      </SafeAreaView>

      {/* Scrollable Tracks List with Session Headers */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {filteredTracks.map((track, trackIndex) => {
          const isCurrentTrack = currentTrack?.id === track.id;
          const showSessionHeader = track.sessionId !== currentSessionId;
          currentSessionId = track.sessionId;

          return (
            <React.Fragment key={track.id}>
              {/* Session Header */}
              {showSessionHeader && (
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionHeaderText}>
                    {formatSessionHeader(track)}
                  </Text>
                </View>
              )}

              {/* Track Item */}
              <TouchableOpacity
                onPress={() => selectTrack(track, trackIndex)}
                style={[
                  styles.trackItem,
                  isCurrentTrack && styles.currentTrackItem,
                  !track.isOriginal && styles.translationTrack
                ]}
              >
                <View style={styles.trackNumberContainer}>
                  <Text style={[
                    styles.trackNumber,
                    isCurrentTrack && styles.currentTrackNumber
                  ]}>
                    {track.order}
                  </Text>
                </View>

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
                </View>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </ScrollView>

      {/* Bottom-sticky Audio Player */}
      <AudioPlayer
        track={currentTrack}
        onProgressUpdate={handleProgressUpdate}
        onTrackComplete={handleTrackComplete}
        onNextTrack={currentTrackIndex < filteredTracks.length - 1 ? goToNextTrack : undefined}
        onPreviousTrack={currentTrackIndex > 0 ? goToPreviousTrack : undefined}
        onPlayingStateChange={setIsTrackPlaying}
        upcomingTracks={filteredTracks.slice(currentTrackIndex + 1)}
        retreatId={retreat.id}
      />

      {/* Overflow Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            {/* Download for offline listening Option */}
            <TouchableOpacity style={styles.menuItem} onPress={handleDownloadForOffline}>
              <Ionicons
                name={isRetreatDownloaded ? "cloud-offline-outline" : "download-outline"}
                size={22}
                color={colors.gray[700]}
              />
              <Text style={styles.menuItemText}>
                {isRetreatDownloaded ? 'Remove Offline Download' : 'Download for offline listening'}
              </Text>
            </TouchableOpacity>

            {/* ZIP Download Option - Only on web/desktop */}
            {Platform.OS === 'web' && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleDownloadRetreatZip}>
                  <Ionicons name="archive-outline" size={22} color={colors.gray[700]} />
                  <Text style={styles.menuItemText}>Download as ZIP</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        buttons={modalState.buttons}
        onClose={hideModal}
        icon={modalState.icon}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonError: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.burgundy[500],
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  downloadBanner: {
    backgroundColor: colors.burgundy[50],
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadBannerContent: {
    flex: 1,
  },
  downloadBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  downloadBannerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.burgundy[700],
  },
  downloadBannerSubtext: {
    fontSize: 12,
    color: colors.burgundy[600],
    marginTop: 6,
  },
  downloadBannerText: {
    fontSize: 14,
    color: colors.burgundy[700],
    marginLeft: 8,
    flex: 1,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.burgundy[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.burgundy[500],
    borderRadius: 3,
  },
  languageSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[700],
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[700],
    marginRight: 4,
  },
  content: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 180,
  },
  sessionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  sessionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.burgundy[600],
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  currentTrackItem: {
    backgroundColor: colors.burgundy[50],
  },
  translationTrack: {
    borderLeftColor: colors.saffron[500],
  },
  trackNumberContainer: {
    width: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -1,
    marginRight: 4,
  },
  trackNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gray[600],
  },
  currentTrackNumber: {
    color: colors.burgundy[600],
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
  trackRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.gray[700],
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginHorizontal: 16,
  },
});
