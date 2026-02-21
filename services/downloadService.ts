/**
 * Download Service - Explicit retreat downloads for offline use
 *
 * This service handles "power user" pre-downloads:
 * - Download entire retreats for offline use
 * - Downloads are pinned and never auto-evicted
 * - User must explicitly remove downloads
 * - Separate from automatic cache
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import retreatService from './retreatService';

// Metadata for a downloaded retreat
export interface DownloadedRetreat {
  retreatId: string;
  retreatName: string;
  trackIds: string[];
  totalSize: number;
  downloadedAt: string;
  trackCount: number;
}

// Progress callback for download operations
export type DownloadProgressCallback = (current: number, total: number, currentTrackName?: string) => void;

// Storage keys
const STORAGE_KEYS = {
  DOWNLOADED_RETREATS: '@downloads:retreats',
  DOWNLOAD_METADATA: '@downloads:metadata_',
};

// Download directory path
const getDownloadsDir = () => `${FileSystem.documentDirectory}downloads/`;
const getRetreatDir = (retreatId: string) => `${getDownloadsDir()}${retreatId}/`;

// Progress listener callback type
type ProgressListener = (progress: { current: number; total: number; startTime: number }) => void;

class DownloadService {
  private static instance: DownloadService;
  private downloadedRetreats: Map<string, DownloadedRetreat> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private activeDownload: { retreatId: string; cancelled: boolean; current: number; total: number; startTime: number } | null = null;
  private progressListeners: Set<ProgressListener> = new Set();
  private readonly isWeb = Platform.OS === 'web';

  static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  /**
   * Initialize the download service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.initPromise = null;
  }

  private async _doInitialize(): Promise<void> {
    if (Platform.OS === 'web') {
      this.initialized = true;
      return;
    }
    try {
      // Ensure downloads directory exists
      const downloadsDir = getDownloadsDir();
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
      }

      // Load downloaded retreats metadata
      const retreatsJson = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_RETREATS);
      if (retreatsJson) {
        const retreatsArray: DownloadedRetreat[] = JSON.parse(retreatsJson);
        this.downloadedRetreats = new Map(retreatsArray.map(r => [r.retreatId, r]));

        // Validate downloaded files still exist
        await this._validateDownloadedFiles();
      }

      this.initialized = true;
      console.log(`📥 Download service initialized: ${this.downloadedRetreats.size} retreats downloaded`);
    } catch (error) {
      console.error('Failed to initialize download service:', error);
      this.initialized = true;
    }
  }

  /**
   * Validate that downloaded retreat directories still exist
   */
  private async _validateDownloadedFiles(): Promise<void> {
    const toRemove: string[] = [];

    for (const [retreatId, retreat] of this.downloadedRetreats) {
      const retreatDir = getRetreatDir(retreatId);
      try {
        const dirInfo = await FileSystem.getInfoAsync(retreatDir);
        if (!dirInfo.exists) {
          toRemove.push(retreatId);
        }
      } catch {
        toRemove.push(retreatId);
      }
    }

    if (toRemove.length > 0) {
      for (const retreatId of toRemove) {
        this.downloadedRetreats.delete(retreatId);
      }
      await this._saveMetadata();
      console.log(`🧹 Cleaned up ${toRemove.length} orphaned download entries`);
    }
  }

  /**
   * Save metadata to persistent storage
   */
  private async _saveMetadata(): Promise<void> {
    const retreatsArray = Array.from(this.downloadedRetreats.values());
    await AsyncStorage.setItem(STORAGE_KEYS.DOWNLOADED_RETREATS, JSON.stringify(retreatsArray));
  }

  /**
   * Download an entire retreat for offline use
   */
  async downloadRetreat(
    retreatId: string,
    retreatName: string,
    tracks: Array<{ id: string; title: string }>,
    onProgress?: DownloadProgressCallback
  ): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
    if (this.isWeb) return { success: false, error: 'Downloads not available on web' };
    await this.initialize();

    // Check if already downloaded
    if (this.downloadedRetreats.has(retreatId)) {
      return { success: true }; // Already downloaded
    }

    // Check if another download is in progress
    if (this.activeDownload) {
      return { success: false, error: 'Another download is already in progress' };
    }

    const startTime = Date.now();
    this.activeDownload = { retreatId, cancelled: false, current: 0, total: tracks.length, startTime };

    try {
      // Create retreat directory
      const retreatDir = getRetreatDir(retreatId);
      const dirInfo = await FileSystem.getInfoAsync(retreatDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(retreatDir, { intermediates: true });
      }

      const downloadedTrackIds: string[] = [];
      let totalSize = 0;
      const total = tracks.length;

      for (let i = 0; i < tracks.length; i++) {
        // Check for cancellation
        if (this.activeDownload?.cancelled) {
          // Clean up partial download
          await this._cleanupPartialDownload(retreatId);
          this.activeDownload = null;
          return { success: false, cancelled: true };
        }

        const track = tracks[i];
        // Update progress in activeDownload and notify listeners
        this.activeDownload.current = i;
        this.notifyProgressListeners();
        onProgress?.(i, total, track.title);

        try {
          // Get presigned URL for the track
          const urlResult = await retreatService.getTrackStreamUrl(track.id);
          if (!urlResult.success || !urlResult.url) {
            console.warn(`Failed to get URL for track ${track.id}, skipping`);
            continue;
          }

          // Download the track
          const filePath = `${retreatDir}${track.id}.mp3`;
          const downloadResult = await FileSystem.downloadAsync(urlResult.url, filePath);

          if (downloadResult.status === 200) {
            // Get file size
            const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
            const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size || 0 : 0;

            // Validate file isn't an error response
            if (fileSize < 10000) {
              const content = await FileSystem.readAsStringAsync(downloadResult.uri, { length: 200 });
              if (content.includes('<?xml') && content.includes('<Error>')) {
                await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
                console.warn(`Track ${track.id} returned error response, skipping`);
                continue;
              }
            }

            downloadedTrackIds.push(track.id);
            totalSize += fileSize;
          }
        } catch (trackError) {
          console.warn(`Failed to download track ${track.id}:`, trackError);
          // Continue with other tracks
        }
      }

      // Final progress update
      if (this.activeDownload) {
        this.activeDownload.current = total;
        this.notifyProgressListeners();
      }
      onProgress?.(total, total);

      // If no tracks were downloaded, consider it a failure
      if (downloadedTrackIds.length === 0) {
        await this._cleanupPartialDownload(retreatId);
        this.activeDownload = null;
        return { success: false, error: 'Failed to download any tracks' };
      }

      // Save retreat metadata
      const downloadedRetreat: DownloadedRetreat = {
        retreatId,
        retreatName,
        trackIds: downloadedTrackIds,
        totalSize,
        downloadedAt: new Date().toISOString(),
        trackCount: downloadedTrackIds.length,
      };

      this.downloadedRetreats.set(retreatId, downloadedRetreat);
      await this._saveMetadata();

      this.activeDownload = null;
      console.log(`✅ Downloaded retreat ${retreatName}: ${downloadedTrackIds.length} tracks, ${Math.round(totalSize / 1024 / 1024)}MB`);
      return { success: true };

    } catch (error) {
      console.error('Error downloading retreat:', error);
      await this._cleanupPartialDownload(retreatId);
      this.activeDownload = null;
      return { success: false, error: 'Failed to download retreat' };
    }
  }

  /**
   * Clean up a partial/failed download
   */
  private async _cleanupPartialDownload(retreatId: string): Promise<void> {
    try {
      const retreatDir = getRetreatDir(retreatId);
      const dirInfo = await FileSystem.getInfoAsync(retreatDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(retreatDir, { idempotent: true });
      }
    } catch (error) {
      console.warn(`Failed to cleanup partial download for ${retreatId}:`, error);
    }
  }

  /**
   * Cancel an in-progress download
   */
  cancelDownload(): void {
    if (this.activeDownload) {
      this.activeDownload.cancelled = true;
      console.log(`❌ Cancelling download for retreat ${this.activeDownload.retreatId}`);
    }
  }

  /**
   * Check if a download is in progress
   */
  isDownloading(): boolean {
    return this.activeDownload !== null;
  }

  /**
   * Get the retreat ID currently being downloaded
   */
  getDownloadingRetreatId(): string | null {
    return this.activeDownload?.retreatId || null;
  }

  /**
   * Get current download progress (if downloading)
   */
  getDownloadProgress(): { retreatId: string; current: number; total: number; startTime: number } | null {
    if (!this.activeDownload) return null;
    return {
      retreatId: this.activeDownload.retreatId,
      current: this.activeDownload.current,
      total: this.activeDownload.total,
      startTime: this.activeDownload.startTime,
    };
  }

  /**
   * Subscribe to download progress updates
   */
  subscribeToProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    // Immediately call with current progress if downloading
    if (this.activeDownload) {
      listener({
        current: this.activeDownload.current,
        total: this.activeDownload.total,
        startTime: this.activeDownload.startTime,
      });
    }
    // Return unsubscribe function
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  /**
   * Notify all progress listeners
   */
  private notifyProgressListeners(): void {
    if (!this.activeDownload) return;
    const progress = {
      current: this.activeDownload.current,
      total: this.activeDownload.total,
      startTime: this.activeDownload.startTime,
    };
    this.progressListeners.forEach(listener => listener(progress));
  }

  /**
   * Remove a downloaded retreat
   */
  async removeDownloadedRetreat(retreatId: string): Promise<{ success: boolean; freedBytes: number }> {
    if (this.isWeb) return { success: false, freedBytes: 0 };
    await this.initialize();

    const retreat = this.downloadedRetreats.get(retreatId);
    if (!retreat) {
      return { success: false, freedBytes: 0 };
    }

    const freedBytes = retreat.totalSize;

    try {
      // Delete retreat directory
      const retreatDir = getRetreatDir(retreatId);
      await FileSystem.deleteAsync(retreatDir, { idempotent: true });

      // Remove from metadata
      this.downloadedRetreats.delete(retreatId);
      await this._saveMetadata();

      console.log(`🗑️ Removed downloaded retreat ${retreat.retreatName}: ${Math.round(freedBytes / 1024 / 1024)}MB`);
      return { success: true, freedBytes };
    } catch (error) {
      console.error(`Failed to remove downloaded retreat ${retreatId}:`, error);
      return { success: false, freedBytes: 0 };
    }
  }

  /**
   * Get all downloaded retreats
   */
  async getDownloadedRetreats(): Promise<DownloadedRetreat[]> {
    await this.initialize();
    return Array.from(this.downloadedRetreats.values());
  }

  /**
   * Check if a retreat is downloaded
   */
  async isRetreatDownloaded(retreatId: string): Promise<boolean> {
    await this.initialize();
    return this.downloadedRetreats.has(retreatId);
  }

  /**
   * Get the local file path for a downloaded track
   */
  async getDownloadedTrackPath(trackId: string): Promise<string | null> {
    if (this.isWeb) return null;
    await this.initialize();

    // Search through all downloaded retreats for this track
    for (const retreat of this.downloadedRetreats.values()) {
      if (retreat.trackIds.includes(trackId)) {
        const filePath = `${getRetreatDir(retreat.retreatId)}${trackId}.mp3`;
        try {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists) {
            return filePath;
          }
        } catch {
          // File doesn't exist
        }
      }
    }

    return null;
  }

  /**
   * Check if a specific track is downloaded (as part of a retreat)
   */
  async isTrackDownloaded(trackId: string): Promise<boolean> {
    const path = await this.getDownloadedTrackPath(trackId);
    return path !== null;
  }

  /**
   * Get total size of all downloads
   */
  async getTotalDownloadSize(): Promise<number> {
    await this.initialize();

    let total = 0;
    for (const retreat of this.downloadedRetreats.values()) {
      total += retreat.totalSize;
    }
    return total;
  }

  /**
   * Get download statistics
   */
  async getDownloadStats(): Promise<{ totalSize: number; retreatCount: number; trackCount: number }> {
    await this.initialize();

    let totalSize = 0;
    let trackCount = 0;

    for (const retreat of this.downloadedRetreats.values()) {
      totalSize += retreat.totalSize;
      trackCount += retreat.trackCount;
    }

    return {
      totalSize,
      retreatCount: this.downloadedRetreats.size,
      trackCount,
    };
  }
}

export default DownloadService.getInstance();
