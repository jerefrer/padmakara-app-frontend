import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import retreatService from '@/services/retreatService';
import downloadService from '@/services/downloadService';
import { ConfirmationModal, ConfirmationButton } from '@/components/ConfirmationModal';
import { OfflineBadge } from '@/components/OfflineBadge';
import { Session } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes, estimateAudioFileSize } from '@/utils/fileSize';
import { API_ENDPOINTS } from '@/services/apiConfig';
import apiService from '@/services/apiService';
import downloadStateService, { DownloadState } from '@/services/downloadStateService';

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

  useEffect(() => {
    loadRetreatDetails();
  }, [id]);

  useEffect(() => {
    if (retreat) {
      checkDownloadStatus();
    }
  }, [retreat]);

  // Track download completion to prevent stale callbacks
  const downloadCompletedRef = useRef(false);

  // Refresh download status when screen comes into focus
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (retreat && hasMountedRef.current) {
        checkDownloadStatus();
        // Also check if download is still in progress
        const downloadingRetreatId = downloadService.getDownloadingRetreatId();
        if (downloadingRetreatId !== id && isDownloadingRetreat) {
          // Download finished while we were away
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
      // A download is in progress for this retreat
      setIsDownloadingRetreat(true);
      const progress = downloadService.getDownloadProgress();
      if (progress) {
        setDownloadProgress({
          current: progress.current,
          total: progress.total,
          startTime: progress.startTime,
        });
      }

      // Subscribe to progress updates
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

  // Handle pending download confirmation - runs the actual download
  useEffect(() => {
    if (!pendingDownloadConfirm || !retreat) return;

    // Reset the flag immediately
    setPendingDownloadConfirm(false);
    downloadCompletedRef.current = false;

    const startDownload = async () => {
      const tracks = getAllTracks();
      const startTime = Date.now();

      setIsDownloadingRetreat(true);
      setDownloadProgress({ current: 0, total: tracks.length, startTime });

      // Subscribe to progress updates (with completion guard)
      const unsubscribe = downloadService.subscribeToProgress((progress) => {
        if (downloadCompletedRef.current) return; // Ignore updates after completion
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

        // Mark as completed to prevent any further progress updates
        downloadCompletedRef.current = true;

        // Cleanup subscription first
        unsubscribe();

        // Update UI state synchronously
        setIsDownloadingRetreat(false);
        setDownloadProgress({ current: 0, total: 0, startTime: 0 });

        if (result.success) {
          // Explicitly set downloaded state (UI updates silently - no confirmation dialog)
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

  const handleSessionPress = (sessionId: string) => {
    router.push(`/session/${sessionId}`);
  };

  const calculateSessionSize = (session: Session) => {
    if (!session.tracks) return 0;
    return session.tracks.reduce((total, track) => {
      return total + (track.file_size || estimateAudioFileSize(track.duration));
    }, 0);
  };

  const calculateTotalRetreatSize = () => {
    if (!retreat) return 0;
    return retreat.sessions.reduce((total, session) => {
      return total + calculateSessionSize(session);
    }, 0);
  };

  const getAllTracks = (): Array<{ id: string; title: string }> => {
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

  const formatSessionInfo = (session: Session) => {
    const tracksCount = session.tracks?.length || 0;
    const sessionSize = formatBytes(calculateSessionSize(session));
    return `${tracksCount} tracks - ${t(`retreats.${session.type}`)} - ${sessionSize}`;
  };

  // Handle download for offline (power user feature)
  const handleDownloadForOffline = async () => {
    if (!retreat) return;
    setMenuVisible(false);

    if (isRetreatDownloaded) {
      // Remove download
      showModal(
        'Remove Download',
        `Remove "${retreat.name}" from offline storage?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              const result = await downloadService.removeDownloadedRetreat(retreat.id);
              if (result.success) {
                setIsRetreatDownloaded(false);
                console.log(`Removed ${formatBytes(result.freedBytes)} of offline content`);
              }
            },
          },
        ],
        'cloud-offline-outline'
      );
      return;
    }

    // Start download - show confirmation modal
    const tracks = getAllTracks();
    const totalSize = formatBytes(calculateTotalRetreatSize());

    showModal(
      'Download for offline listening',
      `Download all ${tracks.length} tracks (${totalSize}) for offline listening?\n\nThis content won't be automatically removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => {
            // Trigger download via useEffect (ensures proper state updates)
            setPendingDownloadConfirm(true);
          },
        },
      ],
      'download-outline'
    );
  };

  // Handle ZIP download (for downloading to computer via browser)
  const handleDownloadRetreatZip = async () => {
    if (!retreat) return;
    setMenuVisible(false);

    if (isDownloadingZip) {
      // Cancel current download
      setIsDownloadingZip(false);
      setZipDownloadProgress('');
      await downloadStateService.removeDownloadState(retreat.id);
      return;
    }

    console.log(`Starting ZIP download for retreat: ${retreat.name}`);
    setIsDownloadingZip(true);
    setZipDownloadProgress('Preparing download...');

    try {
      // Request ZIP generation
      const downloadEndpoint = API_ENDPOINTS.RETREAT_DOWNLOAD_REQUEST(retreat.id);
      const requestResponse = await apiService.post(downloadEndpoint);

      if (!requestResponse.success) {
        throw new Error(requestResponse.error || 'Failed to prepare download');
      }

      const requestId = requestResponse.data?.request_id;
      if (!requestId) {
        throw new Error('No request ID received');
      }

      setCurrentDownloadRequestId(requestId);

      // Save download state
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

      // Poll for completion
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

      // Get download URL
      const downloadResponse = await apiService.get(API_ENDPOINTS.DOWNLOAD_FILE(requestId));

      if (!downloadResponse.data?.success || !downloadResponse.data?.download_url) {
        throw new Error('Failed to get download URL');
      }

      // Open the download URL in browser
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
      {/* Fixed Header Section */}
      <SafeAreaView edges={['top']} style={styles.fixedHeaderContainer}>
        {/* Navigation Header with Overflow Menu */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>{retreat.name}</Text>
              {isRetreatDownloaded && <OfflineBadge />}
            </View>
            <Text style={styles.headerSubtitle}>
              {t(`retreats.${retreat.season}`)} {retreat.year}
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

      </SafeAreaView>

      {/* Scrollable Sessions List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {retreat.sessions
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((session) => (
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
          ))}
      </ScrollView>

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
  backButtonText: {
    color: colors.burgundy[500],
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
  },
  downloadBannerContent: {
    // Content sizes to its children (no flex: 1 needed in column layout)
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
  content: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollContent: {
    padding: 16,
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
  // Overflow Menu Styles
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
