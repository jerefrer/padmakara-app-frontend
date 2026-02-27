import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AudioPlayer } from '@/components/AudioPlayer';
import { AnimatedPlayingBars } from '@/components/AnimatedPlayingBars';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import retreatService from '@/services/retreatService';
import downloadService from '@/services/downloadService';
import { ConfirmationModal, ConfirmationButton } from '@/components/ConfirmationModal';
import { OfflineBadge } from '@/components/OfflineBadge';
import { Session, Track, UserProgress } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { TrackDetailPanel } from '@/components/desktop/TrackDetailPanel';
import { ReadAlongViewer } from '@/components/ReadAlongViewer';
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

const LANG_COLORS: Record<string, { bg: string; text: string }> = {
  en: { bg: '#eff6ff', text: '#1d4ed8' },
  pt: { bg: '#f0fdf4', text: '#15803d' },
  fr: { bg: '#faf5ff', text: '#7e22ce' },
  tib: { bg: '#fffbeb', text: '#b45309' },
};
const DEFAULT_LANG_COLOR = { bg: colors.gray[100], text: colors.gray[500] };

const langBadgeColor = (lang: string) => ({
  backgroundColor: (LANG_COLORS[lang.toLowerCase()] || DEFAULT_LANG_COLOR).bg,
});
const langBadgeTextColor = (lang: string) => ({
  color: (LANG_COLORS[lang.toLowerCase()] || DEFAULT_LANG_COLOR).text,
});

interface TranscriptInfo {
  id: number;
  language: string;
  pageCount?: number;
  updatedAt?: string;
  originalFilename?: string;
}

interface RetreatDetails {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  season: string;
  year: number;
  startDate: string;
  endDate: string;
  sessions: Session[];
  retreat_group?: {
    id: string;
    name: string;
    name_translations?: Record<string, string>;
  };
  transcripts?: TranscriptInfo[];
}

// Flat track with session info for display
interface TrackWithSession extends Track {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionType: string;
  sessionPartNumber?: number | null;
}

export default function RetreatDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { t, contentLanguage, language } = useLanguage();
  const { isDesktop } = useDesktopLayout();
  const audioContext = useAudioPlayerContext();
  const [retreat, setRetreat] = useState<RetreatDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    if (from === 'events') {
      router.replace('/(tabs)/(events)');
    } else {
      router.back();
    }
  }, [from]);

  // Local UI state for track highlighting and playing bars
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackWithSession | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [allTracks, setAllTracks] = useState<TrackWithSession[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<TrackWithSession[]>([]);
  const [currentLanguageMode, setCurrentLanguageMode] = useState<string>('en');

  // Read Along state (mobile)
  const [readAlongModalVisible, setReadAlongModalVisible] = useState(false);
  const [readAlongData, setReadAlongData] = useState<any>(null);
  const [readAlongLoading, setReadAlongLoading] = useState(false);

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
        const LANG_ORDER: Record<string, number> = { en: 0, pt: 1, es: 2, fr: 3 };
        const sortedTracks = [...session.tracks].sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          const aOrig = a.isOriginal ? 0 : 1;
          const bOrig = b.isOriginal ? 0 : 1;
          if (aOrig !== bOrig) return aOrig - bOrig;
          const aLang = LANG_ORDER[a.originalLanguage || a.language || 'en'] ?? 4;
          const bLang = LANG_ORDER[b.originalLanguage || b.language || 'en'] ?? 4;
          return aLang - bLang;
        });
        for (const track of sortedTracks) {
          tracks.push({
            ...track,
            sessionId: session.id,
            sessionName: session.name,
            sessionDate: session.date,
            sessionType: session.type,
            sessionPartNumber: session.partNumber,
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
      // English only - show tracks whose languages include English
      filtered = allTracks.filter(track =>
        track.languages?.includes('en') ?? track.isOriginal !== false
      );
    } else if (currentLanguageMode === 'en-pt') {
      // Both - show all tracks
      filtered = allTracks;
    } else if (currentLanguageMode === 'pt') {
      // Portuguese only - show tracks whose languages include Portuguese
      filtered = allTracks.filter(track =>
        track.languages?.includes('pt') ?? (!track.isOriginal && track.language === 'pt')
      );
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

  // Track selection - updates both local UI state and audio context
  const selectTrack = (track: TrackWithSession, trackIndex: number) => {
    setCurrentTrack(track);
    setCurrentTrackIndex(trackIndex);
    setSelectedTrack(track);
    audioContext.playTrack(track, filteredTracks, trackIndex, {
      retreatId: retreat!.id,
      retreatName: getTranslatedName(retreat!, language) || retreat!.name,
      groupName: retreat!.retreat_group ? (getTranslatedName(retreat!.retreat_group, language) || retreat!.retreat_group.name) : '',
    });
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

  // Register audio context callbacks
  useEffect(() => {
    audioContext.setOnTrackComplete(handleTrackComplete);
    audioContext.setOnProgressUpdate(handleProgressUpdate);
    audioContext.setOnPlayingStateChange(setIsTrackPlaying);

    return () => {
      audioContext.setOnTrackComplete(undefined);
      audioContext.setOnProgressUpdate(undefined);
      audioContext.setOnPlayingStateChange(undefined);
    };
  }, [currentTrackIndex, filteredTracks]);

  // Register next/previous track callbacks
  useEffect(() => {
    audioContext.setOnNextTrack(currentTrackIndex < filteredTracks.length - 1 ? goToNextTrack : undefined);
    audioContext.setOnPreviousTrack(currentTrackIndex > 0 ? goToPreviousTrack : undefined);
    return () => {
      audioContext.setOnNextTrack(undefined);
      audioContext.setOnPreviousTrack(undefined);
    };
  }, [currentTrackIndex, filteredTracks]);

  // Update upcoming tracks for pre-caching when track or list changes
  useEffect(() => {
    if (currentTrack && filteredTracks.length > 0) {
      audioContext.setUpcomingTracks(filteredTracks.slice(currentTrackIndex + 1));
    }
  }, [currentTrackIndex, filteredTracks, currentTrack]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  // Format session date header - "Day 1 · April 18th · Morning · Part 1"
  const formatSessionHeader = (session: { sessionName: string; sessionDate: string; sessionType: string; sessionPartNumber?: number | null }) => {
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
    let header = `Day ${dayNumber} · ${month} ${getOrdinal(dayNum)} · ${sessionType}`;
    if (session.sessionPartNumber) {
      const partLabel = t('retreats.part') || 'Part';
      header += ` · ${partLabel} ${session.sessionPartNumber}`;
    }
    return header;
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

  // Handle Read Along (mobile)
  const handleOpenReadAlong = useCallback(async () => {
    if (!currentTrack) return;
    setReadAlongLoading(true);
    setReadAlongModalVisible(true);
    try {
      const result = await retreatService.getReadAlongData(String(currentTrack.id));
      if (result.success && result.data) {
        setReadAlongData(result.data);
      }
    } catch (err) {
      console.error('Failed to load Read Along:', err);
    } finally {
      setReadAlongLoading(false);
    }
  }, [currentTrack]);

  const handleCloseReadAlong = useCallback(() => {
    setReadAlongModalVisible(false);
    setReadAlongData(null);
  }, []);

  // Reset read along when track changes
  useEffect(() => {
    if (readAlongModalVisible) {
      setReadAlongModalVisible(false);
      setReadAlongData(null);
    }
  }, [currentTrack?.id]);

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
          <TouchableOpacity onPress={handleBack} style={styles.backButtonError}>
            <Text style={styles.backButtonText}>{t('common.goBack') || 'Go Back'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render the track list (shared between desktop master panel and mobile)
  const renderTrackList = (paddingBottom: number) => {
    let trackSessionId: string | null = null;

    return (
      <ScrollView style={styles.content} contentContainerStyle={[styles.scrollContent, { paddingBottom }]}>
        {filteredTracks.map((track, trackIndex) => {
          const isActive = currentTrack?.id === track.id;
          const isSelected = selectedTrack?.id === track.id;
          const showSessionHeader = track.sessionId !== trackSessionId;
          trackSessionId = track.sessionId;

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
                  isActive && styles.currentTrackItem,
                  isDesktop && isSelected && !isActive && styles.selectedTrackItem,
                ]}
              >
                <View style={styles.trackNumberContainer}>
                  <Text style={[
                    styles.trackNumber,
                    isActive && styles.currentTrackNumber
                  ]}>
                    {track.order}
                  </Text>
                </View>

                <View style={styles.trackInfo}>
                  <Text style={[
                    styles.trackTitle,
                    isActive && styles.currentTrackTitle
                  ]}>
                    {track.title}
                  </Text>
                  <View style={styles.trackSubtitleRow}>
                    {track.languages && track.languages.length > 0 && track.languages.map((lang: string) => (
                      <View key={lang} style={[styles.langBadge, langBadgeColor(lang)]}>
                        <Text style={[styles.langBadgeText, langBadgeTextColor(lang)]}>
                          {lang.toUpperCase()}
                        </Text>
                      </View>
                    ))}
                    <Text style={styles.trackDuration}>
                      {[track.speakerName, formatDuration(track.duration)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.trackRightSection}>
                  {isActive && (
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
    );
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header Section */}
      <SafeAreaView edges={['top']} style={styles.fixedHeaderContainer}>
        {/* Navigation Header with Overflow Menu */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
          {/* Read Along button (mobile only — desktop shows in detail panel) */}
          {!isDesktop && currentTrack?.hasReadAlong && (
            <TouchableOpacity
              onPress={handleOpenReadAlong}
              style={styles.menuButton}
            >
              <Ionicons name="text-outline" size={22} color={colors.burgundy[500]} />
            </TouchableOpacity>
          )}
          {/* Transcript button (mobile only — desktop shows in detail panel) */}
          {!isDesktop && retreat.transcripts && retreat.transcripts.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/(groups)/transcript/${retreat.id}` as any)}
              style={styles.menuButton}
            >
              <Ionicons name="document-text-outline" size={22} color={colors.burgundy[500]} />
            </TouchableOpacity>
          )}
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

      {/* Main content: desktop master-detail split vs mobile single column */}
      {isDesktop ? (
        <View style={styles.masterDetailContainer}>
          {/* Master: Track list (40%) */}
          <View style={styles.masterPanel}>
            {renderTrackList(24)}
          </View>
          {/* Detail panel (60%) */}
          <View style={styles.detailPanel}>
            <TrackDetailPanel retreat={retreat} currentTrack={currentTrack} />
          </View>
        </View>
      ) : (
        <>
          {renderTrackList(180)}
          {/* Bottom-sticky Audio Player (mobile only; desktop uses DesktopPlayerBar) */}
          <AudioPlayer />
        </>
      )}

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

      {/* Read Along Modal (mobile) */}
      <Modal
        visible={readAlongModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseReadAlong}
      >
        <SafeAreaView style={styles.readAlongModal}>
          {readAlongLoading ? (
            <View style={styles.readAlongModalLoading}>
              <ActivityIndicator size="large" color={colors.burgundy[500]} />
            </View>
          ) : readAlongData ? (
            <ReadAlongViewer readAlongData={readAlongData} onClose={handleCloseReadAlong} />
          ) : (
            <View style={styles.readAlongModalLoading}>
              <Text style={{ color: colors.gray[500] }}>
                {t('readAlong.unavailable') || 'Read Along not available for this track'}
              </Text>
              <TouchableOpacity onPress={handleCloseReadAlong} style={{ marginTop: 16 }}>
                <Text style={{ color: colors.burgundy[500], fontWeight: '600' }}>
                  {t('common.goBack') || 'Go Back'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  currentTrackItem: {
    backgroundColor: colors.burgundy[50],
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
  trackSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackDuration: {
    fontSize: 12,
    color: colors.gray[500],
  },
  langBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
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
  // Desktop master-detail layout
  masterDetailContainer: {
    flex: 1,
    flexDirection: 'row' as const,
  },
  masterPanel: {
    flex: 0.4,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
  },
  detailPanel: {
    flex: 0.6,
  },
  selectedTrackItem: {
    backgroundColor: colors.gray[100],
    borderLeftColor: colors.burgundy[500],
  },
  readAlongModal: {
    flex: 1,
    backgroundColor: colors.white,
  },
  readAlongModalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
