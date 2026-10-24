/**
 * StorageSection - Storage management UI for Profile screen
 *
 * Shows the app's real on-disk storage usage with management options:
 * - Device storage context
 * - Cache / downloads / videos / publications / other breakdown (measured
 *   by walking the directories, so orphaned files are counted)
 * - Cache limit picker
 * - Clear cache button
 * - Downloaded retreats list with remove option
 * - Offline videos list with remove option
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import cacheService, { CacheStats } from '@/services/cacheService';
import downloadService, { DownloadedRetreat } from '@/services/downloadService';
import { publicationService } from '@/services/publicationService';
import { transcriptCacheService } from '@/services/transcriptCacheService';
import videoDownloadService, { DownloadedVideo } from '@/services/videoDownloadService';
import {
  StorageUsage,
  clearCacheOnlyFiles,
  getStorageUsage,
  removeOrphanedDocuments,
} from '@/services/storageUsageService';
import { BarSegment, getBarSegments } from '@/utils/storageUsage';
import { ConfirmationModal, ConfirmationButton } from '@/components/ConfirmationModal';
import { useLanguage } from '@/contexts/LanguageContext';

const colors = {
  cream: {
    100: '#fefefe',
  },
  burgundy: {
    50: '#f8f1f1',
    500: '#9b1b1b',
    600: '#7b1616',
  },
  saffron: {
    500: '#f59e0b',
  },
  slate: {
    500: '#64748b',
  },
  teal: {
    600: '#0f766e',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2c2c2c',
  },
  success: '#10b981',
  error: '#ef4444',
};

// Cache limit options in bytes (labels will be generated with translations)
const CACHE_LIMIT_VALUES = [
  { size: '500 MB', value: 500 * 1024 * 1024, isDefault: false },
  { size: '1 GB', value: 1024 * 1024 * 1024, isDefault: false },
  { size: '2 GB', value: 2 * 1024 * 1024 * 1024, isDefault: true },
  { size: '5 GB', value: 5 * 1024 * 1024 * 1024, isDefault: false },
  { size: '10 GB', value: 10 * 1024 * 1024 * 1024, isDefault: false },
  { size: '20 GB', value: 20 * 1024 * 1024 * 1024, isDefault: false },
  { size: null, value: 0, isDefault: false, isNoLimit: true },
];

// Bar and legend colour per storage bucket
const SEGMENT_COLORS: Record<BarSegment['key'], string> = {
  cache: colors.saffron[500],
  downloads: colors.burgundy[500],
  videos: colors.teal[600],
  publications: colors.gray[400],
  other: colors.slate[500],
};

// Format bytes to human readable string
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Get label for cache limit value (uses translation function)
const getCacheLimitLabel = (bytes: number, t: (key: string, params?: Record<string, unknown>) => string): string => {
  const option = CACHE_LIMIT_VALUES.find(opt => opt.value === bytes);
  if (option) {
    if (option.isNoLimit) return t('storage.noLimit') || 'No Limit';
    const defaultSuffix = option.isDefault ? ` ${t('storage.default') || '(Default)'}` : '';
    return `${option.size}${defaultSuffix}`;
  }
  return formatBytes(bytes);
};

interface StorageSectionProps {
  onStorageChange?: () => void;
}

export function StorageSection({ onStorageChange }: StorageSectionProps) {
  const { t } = useLanguage();
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheLimit, setCacheLimit] = useState<number>(2 * 1024 * 1024 * 1024);
  const [downloadedRetreats, setDownloadedRetreats] = useState<DownloadedRetreat[]>([]);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [offlineVideos, setOfflineVideos] = useState<DownloadedVideo[]>([]);
  const [removingVideoId, setRemovingVideoId] = useState<number | null>(null);
  const [isFreeingOther, setIsFreeingOther] = useState(false);
  const [deviceFreeSpace, setDeviceFreeSpace] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearingDownloads, setIsClearingDownloads] = useState(false);
  const [showLimitPicker, setShowLimitPicker] = useState(false);
  const [removingRetreatId, setRemovingRetreatId] = useState<string | null>(null);
  const [publicationCacheStats, setPublicationCacheStats] = useState<{ totalSize: number; count: number } | null>(null);
  const [isClearingPublications, setIsClearingPublications] = useState(false);

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

  // Load storage data
  const loadStorageData = useCallback(async (): Promise<StorageUsage | null> => {
    let usageResult: StorageUsage | null = null;
    try {
      setLoading(true);

      // Load cache stats
      const stats = await cacheService.getCacheStats();
      setCacheStats(stats);

      // Load cache settings
      const settings = await cacheService.getCacheSettings();
      setCacheLimit(settings.maxSizeBytes);

      // Load downloaded retreats
      const retreats = await downloadService.getDownloadedRetreats();
      setDownloadedRetreats(retreats);

      // Measure what is really on disk (orphans and partial files included)
      const measured = await getStorageUsage(retreats.map(r => r.retreatId));
      usageResult = measured;
      setUsage(measured);
      setOfflineVideos(await videoDownloadService.listDownloads());

      // Load publication cache stats
      try {
        const pubStats = await publicationService.getCacheStats();
        setPublicationCacheStats(pubStats);
      } catch (err) {
        console.warn('Could not load publication cache stats:', err);
      }

      // Get device free space (only works on native platforms)
      if (Platform.OS !== 'web') {
        try {
          const freeSpace = await FileSystem.getFreeDiskStorageAsync();
          setDeviceFreeSpace(freeSpace);
        } catch (err) {
          console.warn('Could not get device free space:', err);
        }
      }
    } catch (error) {
      console.error('Failed to load storage data:', error);
    } finally {
      setLoading(false);
    }
    return usageResult;
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadStorageData();
    }, [loadStorageData])
  );

  useEffect(() => {
    loadStorageData();
  }, [loadStorageData]);

  // Handle cache limit change
  const handleCacheLimitChange = async (newLimit: number) => {
    try {
      await cacheService.setCacheLimit(newLimit);
      setCacheLimit(newLimit);
      setShowLimitPicker(false);

      // Reload stats (eviction may have occurred)
      const stats = await cacheService.getCacheStats();
      setCacheStats(stats);

      onStorageChange?.();
    } catch (error) {
      console.error('Failed to set cache limit:', error);
      showModal('Error', 'Failed to update cache limit', [{ text: 'OK' }], 'alert-circle-outline');
    }
  };

  // Handle clear cache
  const handleClearCache = () => {
    if (isClearing) return;

    showModal(
      t('storage.clearCacheTitle') || 'Clear Cache',
      t('storage.clearCacheMessage') || 'This removes cached audio, event files and transcripts. They are fetched again when you open them. Your downloads, videos and publications are kept.',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('storage.clearCacheTitle') || 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              const before = usage?.clearableBytes ?? 0;
              await cacheService.clearCache();
              await transcriptCacheService.clearCache();
              await clearCacheOnlyFiles();
              const after = await loadStorageData();
              const freed = Math.max(0, before - (after?.clearableBytes ?? 0));
              showModal(
                t('storage.cacheCleared') || 'Cache Cleared',
                t('storage.cacheClearedMessage', { size: formatBytes(freed) }) || `${formatBytes(freed)} freed.`,
                [{ text: t('common.ok') || 'OK' }],
                'checkmark-circle-outline'
              );
              onStorageChange?.();
            } catch (error) {
              console.error('Failed to clear cache:', error);
              showModal(t('common.error') || 'Error', t('storage.clearFailed') || 'Something went wrong while clearing. Please try again.', [{ text: t('common.ok') || 'OK' }], 'alert-circle-outline');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
      'trash-outline'
    );
  };

  // Handle freeing leftovers in document storage (orphaned downloads)
  const handleFreeOtherSpace = () => {
    if (isFreeingOther) return;

    showModal(
      t('storage.freeUpOtherTitle') || 'Free up other space',
      t('storage.freeUpOtherMessage') || 'This removes files left by interrupted downloads. Your downloaded retreats, videos and publications are not touched.',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('storage.freeUpOtherAction') || 'Free up',
          style: 'destructive',
          onPress: async () => {
            setIsFreeingOther(true);
            try {
              const freed = await removeOrphanedDocuments(downloadedRetreats.map(r => r.retreatId));
              await loadStorageData();
              showModal(
                t('storage.freedSpaceTitle') || 'Space freed',
                t('storage.freedSpaceMessage', { size: formatBytes(freed) }) || `${formatBytes(freed)} freed.`,
                [{ text: t('common.ok') || 'OK' }],
                'checkmark-circle-outline'
              );
              onStorageChange?.();
            } catch (error) {
              console.error('Failed to free up space:', error);
              showModal(t('common.error') || 'Error', t('storage.clearFailed') || 'Something went wrong while clearing. Please try again.', [{ text: t('common.ok') || 'OK' }], 'alert-circle-outline');
            } finally {
              setIsFreeingOther(false);
            }
          },
        },
      ],
      'trash-outline'
    );
  };

  // Handle remove offline video
  const handleRemoveVideo = (video: DownloadedVideo) => {
    if (removingVideoId !== null) return;
    const name = video.title || t('storage.offlineVideoUntitled') || 'Offline video';

    showModal(
      t('storage.removeVideoTitle') || 'Remove video',
      t('storage.removeVideoMessage', { name }) || `Remove "${name}" from this device? You can download it again later.`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.remove') || 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingVideoId(video.videoId);
            try {
              await videoDownloadService.delete(video.videoId);
              await loadStorageData();
              onStorageChange?.();
            } catch (error) {
              console.error('Failed to remove video:', error);
              showModal(t('common.error') || 'Error', t('storage.removeVideoFailed') || 'The video could not be removed.', [{ text: t('common.ok') || 'OK' }], 'alert-circle-outline');
            } finally {
              setRemovingVideoId(null);
            }
          },
        },
      ],
      'videocam-outline'
    );
  };

  // Handle clear all downloads
  const handleClearDownloads = () => {
    if (isClearingDownloads || downloadedRetreats.length === 0) return;

    showModal(
      'Clear Downloads',
      `Remove all ${downloadedRetreats.length} downloaded retreat${downloadedRetreats.length !== 1 ? 's' : ''}? You can re-download them later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Downloads',
          style: 'destructive',
          onPress: async () => {
            setIsClearingDownloads(true);
            try {
              let totalFreed = 0;
              let removed = 0;
              for (const retreat of downloadedRetreats) {
                const result = await downloadService.removeDownloadedRetreat(retreat.retreatId);
                if (result.success) {
                  totalFreed += result.freedBytes;
                  removed++;
                }
              }
              showModal(
                'Downloads Cleared',
                `Removed ${removed} downloaded retreat${removed !== 1 ? 's' : ''} (${formatBytes(totalFreed)})`,
                [{ text: 'OK' }],
                'checkmark-circle-outline'
              );
              await loadStorageData();
              onStorageChange?.();
            } catch (error) {
              console.error('Failed to clear downloads:', error);
              showModal('Error', 'Failed to clear downloads', [{ text: 'OK' }], 'alert-circle-outline');
            } finally {
              setIsClearingDownloads(false);
            }
          },
        },
      ],
      'trash-outline'
    );
  };

  // Handle clear publication cache
  const handleClearPublicationCache = () => {
    if (isClearingPublications) return;

    showModal(
      t('storage.clearPublicationsTitle') || 'Clear Publications Cache',
      t('storage.clearPublicationsMessage') || 'This will remove all cached publication PDFs. They will be re-downloaded when you open them again.',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('storage.clearPublicationsAction') || 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearingPublications(true);
            try {
              await publicationService.clearCache();
              showModal(
                t('storage.publicationsCacheCleared') || 'Publications Cache Cleared',
                t('storage.publicationsCacheClearedMessage') || 'All cached publication PDFs have been removed.',
                [{ text: 'OK' }],
                'checkmark-circle-outline'
              );
              await loadStorageData();
              onStorageChange?.();
            } catch (error) {
              console.error('Failed to clear publication cache:', error);
              showModal('Error', 'Failed to clear publication cache', [{ text: 'OK' }], 'alert-circle-outline');
            } finally {
              setIsClearingPublications(false);
            }
          },
        },
      ],
      'trash-outline'
    );
  };

  // Handle remove downloaded retreat
  const handleRemoveDownload = (retreat: DownloadedRetreat) => {
    if (removingRetreatId) return;

    showModal(
      'Remove Download',
      `Remove "${retreat.retreatName}" from downloads? You can re-download it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingRetreatId(retreat.retreatId);
            try {
              const result = await downloadService.removeDownloadedRetreat(retreat.retreatId);
              if (result.success) {
                await loadStorageData();
                onStorageChange?.();
              } else {
                showModal('Error', 'Failed to remove download', [{ text: 'OK' }], 'alert-circle-outline');
              }
            } catch (error) {
              console.error('Failed to remove download:', error);
              showModal('Error', 'Failed to remove download', [{ text: 'OK' }], 'alert-circle-outline');
            } finally {
              setRemovingRetreatId(null);
            }
          },
        },
      ],
      'cloud-offline-outline'
    );
  };

  // Bar segments are each bucket's share of the app's total storage
  const barSegments = usage ? getBarSegments(usage) : [];
  const legendItems: { key: BarSegment['key']; label: string }[] = usage
    ? [
        { key: 'cache', label: t('storage.cache', { size: formatBytes(usage.cache) }) || `Cache: ${formatBytes(usage.cache)}` },
        { key: 'downloads', label: t('storage.downloads', { size: formatBytes(usage.downloads) }) || `Downloads: ${formatBytes(usage.downloads)}` },
        { key: 'videos', label: t('storage.videos', { size: formatBytes(usage.videos) }) || `Videos: ${formatBytes(usage.videos)}` },
        { key: 'publications', label: t('storage.publicationsLegend', { size: formatBytes(usage.publications) }) || `Publications: ${formatBytes(usage.publications)}` },
        { key: 'other', label: t('storage.other', { size: formatBytes(usage.other) }) || `Other: ${formatBytes(usage.other)}` },
      ]
    : [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.burgundy[500]} />
        <Text style={styles.loadingText}>{t('storage.loadingStorageInfo') || 'Loading storage info...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Device Storage Info */}
      {deviceFreeSpace !== null && (
        <View style={styles.deviceInfo}>
          <Ionicons name="phone-portrait-outline" size={16} color={colors.gray[500]} />
          <Text style={styles.deviceInfoText}>
            {t('storage.freeOnDevice', { size: formatBytes(deviceFreeSpace) }) || `${formatBytes(deviceFreeSpace)} free on device`}
          </Text>
        </View>
      )}

      {/* Storage Bar */}
      <View style={styles.storageBarContainer}>
        <View style={styles.storageBar}>
          {barSegments.map(segment => (
            <View
              key={segment.key}
              style={[
                styles.storageBarSegment,
                { width: `${segment.percent}%`, backgroundColor: SEGMENT_COLORS[segment.key] },
              ]}
            />
          ))}
        </View>
        {cacheLimit > 0 && (
          <Text style={styles.limitLabel}>{t('storage.limit', { size: formatBytes(cacheLimit) }) || `Limit: ${formatBytes(cacheLimit)}`}</Text>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {legendItems.map(item => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: SEGMENT_COLORS[item.key] }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Cache Limit Setting */}
      <Pressable
        style={({ pressed }) => [
          styles.settingItem,
          pressed && Platform.OS === 'web' && styles.webPressed,
        ]}
        onPress={() => setShowLimitPicker(true)}
      >
        <View style={styles.settingLeft}>
          <Ionicons name="speedometer-outline" size={20} color={colors.saffron[500]} />
          <View style={styles.textContainer}>
            <Text style={styles.settingTitle}>{t('storage.cacheLimit') || 'Cache Limit'}</Text>
            <Text style={styles.settingSubtitle}>
              {t('storage.cacheLimitDescription') || 'Maximum space for auto-cached tracks'}
            </Text>
          </View>
        </View>
        <View style={styles.settingRight}>
          <Text style={styles.settingValue}>{getCacheLimitLabel(cacheLimit, t)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
        </View>
      </Pressable>

      {/* Clear Cache Button */}
      {((usage?.clearableBytes || 0) > 0 || (cacheStats?.trackCount || 0) > 0) && (
        <Pressable
          style={({ pressed }) => [
            styles.settingItem,
            isClearing && styles.disabledSetting,
            pressed && Platform.OS === 'web' && styles.webPressed,
          ]}
          onPress={handleClearCache}
          disabled={isClearing}
        >
          <View style={styles.settingLeft}>
            {isClearing ? (
              <ActivityIndicator size="small" color={colors.saffron[500]} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={colors.saffron[500]} />
            )}
            <View style={styles.textContainer}>
              <Text style={[styles.settingTitle, isClearing && styles.disabledText]}>
                {t('storage.clearCache') || 'Clear Cache'}
              </Text>
              <Text style={styles.settingSubtitle}>
                {t('storage.clearCacheDescription') || 'Remove auto-cached audio, event files and transcripts'}
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Free Up Other Space (orphaned downloads in document storage) */}
      {(usage?.orphanBytes || 0) > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.settingItem,
            isFreeingOther && styles.disabledSetting,
            pressed && Platform.OS === 'web' && styles.webPressed,
          ]}
          onPress={handleFreeOtherSpace}
          disabled={isFreeingOther}
        >
          <View style={styles.settingLeft}>
            {isFreeingOther ? (
              <ActivityIndicator size="small" color={colors.slate[500]} />
            ) : (
              <Ionicons name="file-tray-outline" size={20} color={colors.slate[500]} />
            )}
            <View style={styles.textContainer}>
              <Text style={[styles.settingTitle, isFreeingOther && styles.disabledText]}>
                {t('storage.freeUpOther') || 'Free up other space'}
              </Text>
              <Text style={styles.settingSubtitle}>
                {t('storage.freeUpOtherDescription', { size: formatBytes(usage?.orphanBytes || 0) }) || `Remove leftovers from interrupted downloads (${formatBytes(usage?.orphanBytes || 0)})`}
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Clear Downloads Button */}
      {downloadedRetreats.length > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.settingItem,
            isClearingDownloads && styles.disabledSetting,
            pressed && Platform.OS === 'web' && styles.webPressed,
          ]}
          onPress={handleClearDownloads}
          disabled={isClearingDownloads}
        >
          <View style={styles.settingLeft}>
            {isClearingDownloads ? (
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={colors.burgundy[500]} />
            )}
            <View style={styles.textContainer}>
              <Text style={[styles.settingTitle, isClearingDownloads && styles.disabledText]}>
                {t('storage.clearDownloads') || 'Clear Downloads'}
              </Text>
              <Text style={styles.settingSubtitle}>
                {t('storage.clearDownloadsDescription') || 'Remove all downloaded retreats'}
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Clear Publications Cache Button */}
      {(publicationCacheStats?.count || 0) > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.settingItem,
            isClearingPublications && styles.disabledSetting,
            pressed && Platform.OS === 'web' && styles.webPressed,
          ]}
          onPress={handleClearPublicationCache}
          disabled={isClearingPublications}
        >
          <View style={styles.settingLeft}>
            {isClearingPublications ? (
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
            ) : (
              <Ionicons name="book-outline" size={20} color={colors.burgundy[500]} />
            )}
            <View style={styles.textContainer}>
              <Text style={[styles.settingTitle, isClearingPublications && styles.disabledText]}>
                {t('storage.clearPublications') || 'Clear Publications Cache'}
              </Text>
              <Text style={styles.settingSubtitle}>
                {(t('storage.publicationsCacheInfo') || '{count} publications ({size})').replace('{count}', String(publicationCacheStats?.count || 0)).replace('{size}', formatBytes(usage?.publications ?? publicationCacheStats?.totalSize ?? 0))}
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Downloaded Retreats List */}
      {downloadedRetreats.length > 0 && (
        <View style={styles.downloadsSection}>
          <View style={styles.downloadsSectionHeader}>
            <Ionicons name="cloud-download" size={14} color={colors.gray[500]} />
            <Text style={styles.downloadsSectionTitle}>{t('storage.downloadedRetreats') || 'DOWNLOADED RETREATS'}</Text>
          </View>
          {downloadedRetreats.map(retreat => (
            <View key={retreat.retreatId} style={styles.downloadedRetreatItem}>
              <View style={styles.retreatInfo}>
                <Text style={styles.retreatName} numberOfLines={1}>
                  {retreat.retreatName}
                </Text>
                <Text style={styles.retreatMeta}>
                  {retreat.trackCount === 1
                    ? (t('storage.trackCount', { count: retreat.trackCount }) || '1 track')
                    : (t('storage.tracksCount', { count: retreat.trackCount }) || `${retreat.trackCount} tracks`)
                  } • {formatBytes(retreat.totalSize)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.removeButtonPressed,
                ]}
                onPress={() => handleRemoveDownload(retreat)}
                disabled={removingRetreatId === retreat.retreatId}
              >
                {removingRetreatId === retreat.retreatId ? (
                  <ActivityIndicator size="small" color={colors.gray[400]} />
                ) : (
                  <Ionicons name="close-circle" size={24} color={colors.gray[400]} />
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Offline Videos List */}
      {offlineVideos.length > 0 && (
        <View style={styles.downloadsSection}>
          <View style={styles.downloadsSectionHeader}>
            <Ionicons name="videocam" size={14} color={colors.gray[500]} />
            <Text style={styles.downloadsSectionTitle}>{t('storage.offlineVideos') || 'OFFLINE VIDEOS'}</Text>
          </View>
          {offlineVideos.map(video => (
            <View key={video.videoId} style={styles.downloadedRetreatItem}>
              <View style={styles.retreatInfo}>
                <Text style={styles.retreatName} numberOfLines={1}>
                  {video.title || t('storage.offlineVideoUntitled') || 'Offline video'}
                </Text>
                <Text style={styles.retreatMeta} numberOfLines={1}>
                  {video.eventTitle ? `${video.eventTitle} • ` : ''}{formatBytes(video.size)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.removeButtonPressed,
                ]}
                onPress={() => handleRemoveVideo(video)}
                disabled={removingVideoId === video.videoId}
                accessibilityRole="button"
                accessibilityLabel={t('storage.removeVideoTitle') || 'Remove video'}
              >
                {removingVideoId === video.videoId ? (
                  <ActivityIndicator size="small" color={colors.gray[400]} />
                ) : (
                  <Ionicons name="close-circle" size={24} color={colors.gray[400]} />
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Cache Limit Picker Modal */}
      <Modal
        visible={showLimitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLimitPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLimitPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('storage.cacheLimit') || 'Cache Limit'}</Text>
            <ScrollView style={styles.optionsList}>
              {CACHE_LIMIT_VALUES.map(option => {
                const label = option.isNoLimit
                  ? (t('storage.noLimit') || 'No Limit')
                  : `${option.size}${option.isDefault ? ` ${t('storage.default') || '(Default)'}` : ''}`;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionItem,
                      cacheLimit === option.value && styles.optionItemSelected,
                    ]}
                    onPress={() => handleCacheLimitChange(option.value)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        cacheLimit === option.value && styles.optionTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    {cacheLimit === option.value && (
                      <Ionicons name="checkmark" size={20} color={colors.burgundy[500]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLimitPicker(false)}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel') || 'Cancel'}</Text>
            </TouchableOpacity>
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
    backgroundColor: 'transparent',
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'visible',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  loadingContainer: {
    backgroundColor: 'transparent',
    padding: 24,
    alignItems: 'center',
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'visible',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 8,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  deviceInfoText: {
    fontSize: 14,
    color: colors.gray[500],
    marginLeft: 8,
  },
  storageBarContainer: {
    paddingVertical: 12,
  },
  storageBar: {
    height: 12,
    backgroundColor: colors.gray[200],
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  storageBarSegment: {
    height: '100%',
  },
  limitLabel: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 4,
    textAlign: 'right',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.gray[600],
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray[800],
    marginLeft: 12,
  },
  settingSubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    marginLeft: 12,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    color: colors.gray[600],
    marginRight: 8,
  },
  disabledSetting: {
    opacity: 0.6,
  },
  disabledText: {
    color: colors.gray[400],
  },
  webPressed: {
    backgroundColor: colors.gray[100],
    opacity: 0.8,
  },
  downloadsSection: {
  },
  downloadsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.gray[100],
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  downloadsSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray[500],
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  downloadedRetreatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  retreatInfo: {
    flex: 1,
    marginRight: 12,
  },
  retreatName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[700],
  },
  retreatMeta: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  removeButtonPressed: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    width: '80%',
    maxWidth: 320,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[800],
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  optionItemSelected: {
    backgroundColor: colors.burgundy[50],
  },
  optionText: {
    fontSize: 16,
    color: colors.gray[700],
  },
  optionTextSelected: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },
  modalCancelButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  modalCancelText: {
    fontSize: 16,
    color: colors.gray[500],
    fontWeight: '500',
  },
});

export default StorageSection;
