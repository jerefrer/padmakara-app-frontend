/**
 * StorageSection - Storage management UI for Profile screen
 *
 * Shows cache and download storage usage with management options:
 * - Device storage context
 * - Cache vs downloads breakdown
 * - Cache limit picker
 * - Clear cache button
 * - Downloaded retreats list with remove option
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
import * as FileSystem from 'expo-file-system';
import cacheService, { CacheStats } from '@/services/cacheService';
import downloadService, { DownloadedRetreat } from '@/services/downloadService';
import { ConfirmationModal, ConfirmationButton } from '@/components/ConfirmationModal';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    500: '#b91c1c',
    600: '#991b1b',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
  },
  success: '#10b981',
  error: '#ef4444',
};

// Cache limit options in bytes
const CACHE_LIMIT_OPTIONS = [
  { label: '500 MB', value: 500 * 1024 * 1024 },
  { label: '1 GB', value: 1024 * 1024 * 1024 },
  { label: '2 GB (Default)', value: 2 * 1024 * 1024 * 1024 },
  { label: '5 GB', value: 5 * 1024 * 1024 * 1024 },
  { label: '10 GB', value: 10 * 1024 * 1024 * 1024 },
  { label: '20 GB', value: 20 * 1024 * 1024 * 1024 },
  { label: 'No Limit', value: 0 },
];

// Format bytes to human readable string
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Get label for cache limit value
const getCacheLimitLabel = (bytes: number): string => {
  const option = CACHE_LIMIT_OPTIONS.find(opt => opt.value === bytes);
  if (option) return option.label;
  return formatBytes(bytes);
};

interface StorageSectionProps {
  onStorageChange?: () => void;
}

export function StorageSection({ onStorageChange }: StorageSectionProps) {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheLimit, setCacheLimit] = useState<number>(2 * 1024 * 1024 * 1024);
  const [downloadedRetreats, setDownloadedRetreats] = useState<DownloadedRetreat[]>([]);
  const [totalDownloadSize, setTotalDownloadSize] = useState(0);
  const [deviceFreeSpace, setDeviceFreeSpace] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearingDownloads, setIsClearingDownloads] = useState(false);
  const [showLimitPicker, setShowLimitPicker] = useState(false);
  const [removingRetreatId, setRemovingRetreatId] = useState<string | null>(null);

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
  const loadStorageData = useCallback(async () => {
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

      // Calculate total download size
      const downloadSize = await downloadService.getTotalDownloadSize();
      setTotalDownloadSize(downloadSize);

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
      'Clear Cache',
      'This will remove all cached audio files. They will be re-cached when you play them again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              const result = await cacheService.clearCache();
              showModal(
                'Cache Cleared',
                `Removed ${result.tracksRemoved} cached tracks (${formatBytes(result.freedBytes)})`,
                [{ text: 'OK' }],
                'checkmark-circle-outline'
              );
              await loadStorageData();
              onStorageChange?.();
            } catch (error) {
              console.error('Failed to clear cache:', error);
              showModal('Error', 'Failed to clear cache', [{ text: 'OK' }], 'alert-circle-outline');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
      'trash-outline'
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

  // Calculate storage bar widths
  const totalUsed = (cacheStats?.totalSize || 0) + totalDownloadSize;
  const maxForBar = cacheLimit > 0 ? cacheLimit : totalUsed * 1.5 || 1;
  const cacheWidth = cacheStats?.totalSize ? (cacheStats.totalSize / maxForBar) * 100 : 0;
  const downloadWidth = totalDownloadSize ? (totalDownloadSize / maxForBar) * 100 : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.burgundy[500]} />
        <Text style={styles.loadingText}>Loading storage info...</Text>
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
            {formatBytes(deviceFreeSpace)} free on device
          </Text>
        </View>
      )}

      {/* Storage Bar */}
      <View style={styles.storageBarContainer}>
        <View style={styles.storageBar}>
          <View
            style={[
              styles.storageBarSegment,
              styles.cacheSegment,
              { width: `${Math.min(cacheWidth, 100)}%` },
            ]}
          />
          <View
            style={[
              styles.storageBarSegment,
              styles.downloadSegment,
              { width: `${Math.min(downloadWidth, 100 - cacheWidth)}%` },
            ]}
          />
        </View>
        {cacheLimit > 0 && (
          <Text style={styles.limitLabel}>Limit: {formatBytes(cacheLimit)}</Text>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.saffron[500] }]} />
          <Text style={styles.legendText}>
            Cache: {formatBytes(cacheStats?.totalSize || 0)}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.burgundy[500] }]} />
          <Text style={styles.legendText}>
            Downloads: {formatBytes(totalDownloadSize)}
          </Text>
        </View>
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
          <Ionicons name="speedometer-outline" size={20} color={colors.burgundy[500]} />
          <View style={styles.textContainer}>
            <Text style={styles.settingTitle}>Cache Limit</Text>
            <Text style={styles.settingSubtitle}>
              Maximum space for auto-cached tracks
            </Text>
          </View>
        </View>
        <View style={styles.settingRight}>
          <Text style={styles.settingValue}>{getCacheLimitLabel(cacheLimit)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
        </View>
      </Pressable>

      {/* Downloaded Retreats List */}
      {downloadedRetreats.length > 0 && (
        <View style={styles.downloadsSection}>
          <Text style={styles.downloadsSectionTitle}>Downloaded Retreats</Text>
          {downloadedRetreats.map(retreat => (
            <View key={retreat.retreatId} style={styles.downloadedRetreatItem}>
              <View style={styles.retreatInfo}>
                <Text style={styles.retreatName} numberOfLines={1}>
                  {retreat.retreatName}
                </Text>
                <Text style={styles.retreatMeta}>
                  {retreat.trackCount} tracks • {formatBytes(retreat.totalSize)}
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

      {/* Clear Buttons */}
      <View style={styles.clearButtonsContainer}>
        {(cacheStats?.trackCount || 0) > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.clearButton,
              isClearing && styles.disabledSetting,
              pressed && Platform.OS === 'web' && styles.webPressed,
            ]}
            onPress={handleClearCache}
            disabled={isClearing}
          >
            {isClearing ? (
              <ActivityIndicator size="small" color={colors.saffron[500]} />
            ) : (
              <Ionicons name="trash-outline" size={18} color={colors.saffron[500]} />
            )}
            <Text style={[styles.clearButtonText, { color: colors.saffron[500] }, isClearing && styles.disabledText]}>
              Clear cache
            </Text>
          </Pressable>
        )}
        {downloadedRetreats.length > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.clearButton,
              isClearingDownloads && styles.disabledSetting,
              pressed && Platform.OS === 'web' && styles.webPressed,
            ]}
            onPress={handleClearDownloads}
            disabled={isClearingDownloads}
          >
            {isClearingDownloads ? (
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
            ) : (
              <Ionicons name="trash-outline" size={18} color={colors.burgundy[500]} />
            )}
            <Text style={[styles.clearButtonText, { color: colors.burgundy[500] }, isClearingDownloads && styles.disabledText]}>
              Clear downloads
            </Text>
          </Pressable>
        )}
      </View>

      {/* Cache Limit Picker Modal */}
      <Modal
        visible={showLimitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLimitPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLimitPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cache Limit</Text>
            <ScrollView style={styles.optionsList}>
              {CACHE_LIMIT_OPTIONS.map(option => (
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
                    {option.label}
                  </Text>
                  {cacheLimit === option.value && (
                    <Ionicons name="checkmark" size={20} color={colors.burgundy[500]} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLimitPicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
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
    backgroundColor: 'white',
    marginBottom: 12,
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 8,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  deviceInfoText: {
    fontSize: 14,
    color: colors.gray[500],
    marginLeft: 8,
  },
  storageBarContainer: {
    paddingHorizontal: 20,
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
  cacheSegment: {
    backgroundColor: colors.saffron[500],
  },
  downloadSegment: {
    backgroundColor: colors.burgundy[500],
  },
  limitLabel: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 4,
    textAlign: 'right',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
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
    paddingTop: 16,
  },
  downloadsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[600],
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  downloadedRetreatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  clearButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
    marginTop: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
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
