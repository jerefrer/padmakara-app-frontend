/**
 * Cache Service - Transparent audio caching with LRU eviction
 *
 * This service provides Spotify-style automatic caching:
 * - Tracks are cached automatically when played
 * - LRU (Least Recently Used) eviction when cache limit is reached
 * - Current retreat is protected from eviction
 * - User-configurable cache limit (500MB to No Limit)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// Cache metadata for each cached track
export interface CacheMetadata {
  trackId: string;
  retreatId: string;
  filePath: string;
  fileSize: number;
  cachedAt: string;
  lastAccessedAt: string;
}

// User's cache settings
export interface CacheSettings {
  maxSizeBytes: number; // 0 = no limit
}

// Cache statistics for UI display
export interface CacheStats {
  totalSize: number;
  trackCount: number;
  oldestTrack?: string;
  newestTrack?: string;
}

// Storage keys
const STORAGE_KEYS = {
  CACHE_METADATA: '@audio_cache:metadata',
  CACHE_SETTINGS: '@audio_cache:settings',
};

// Default cache limit: 2GB
const DEFAULT_CACHE_LIMIT = 2 * 1024 * 1024 * 1024;

// Cache directory path
const getCacheDir = () => `${FileSystem.cacheDirectory}audio/`;

class CacheService {
  private static instance: CacheService;
  private metadata: Map<string, CacheMetadata> = new Map();
  private settings: CacheSettings = { maxSizeBytes: DEFAULT_CACHE_LIMIT };
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private readonly isWeb = Platform.OS === 'web';

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Initialize the cache service - loads metadata and settings from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Prevent multiple concurrent initializations
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
      // Ensure cache directory exists
      const cacheDir = getCacheDir();
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      // Load settings
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.CACHE_SETTINGS);
      if (settingsJson) {
        this.settings = JSON.parse(settingsJson);
      }

      // Load metadata
      const metadataJson = await AsyncStorage.getItem(STORAGE_KEYS.CACHE_METADATA);
      if (metadataJson) {
        const metadataArray: CacheMetadata[] = JSON.parse(metadataJson);
        this.metadata = new Map(metadataArray.map(m => [m.trackId, m]));

        // Validate cached files still exist
        await this._validateCachedFiles();
      }

      this.initialized = true;
      console.log(`📦 Cache service initialized: ${this.metadata.size} tracks cached`);
    } catch (error) {
      console.error('Failed to initialize cache service:', error);
      this.initialized = true; // Still mark as initialized to prevent infinite loops
    }
  }

  /**
   * Validate that cached files still exist on disk
   */
  private async _validateCachedFiles(): Promise<void> {
    const toRemove: string[] = [];

    for (const [trackId, meta] of this.metadata) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(meta.filePath);
        if (!fileInfo.exists) {
          toRemove.push(trackId);
        }
      } catch {
        toRemove.push(trackId);
      }
    }

    if (toRemove.length > 0) {
      for (const trackId of toRemove) {
        this.metadata.delete(trackId);
      }
      await this._saveMetadata();
      console.log(`🧹 Cleaned up ${toRemove.length} orphaned cache entries`);
    }
  }

  /**
   * Save metadata to persistent storage
   */
  private async _saveMetadata(): Promise<void> {
    const metadataArray = Array.from(this.metadata.values());
    await AsyncStorage.setItem(STORAGE_KEYS.CACHE_METADATA, JSON.stringify(metadataArray));
  }

  /**
   * Save settings to persistent storage
   */
  private async _saveSettings(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CACHE_SETTINGS, JSON.stringify(this.settings));
  }

  /**
   * Get the local file path for a cached track, or null if not cached
   */
  async getCachedTrackPath(trackId: string): Promise<string | null> {
    if (this.isWeb) return null;
    await this.initialize();

    const meta = this.metadata.get(trackId);
    if (!meta) return null;

    // Verify file still exists
    try {
      const fileInfo = await FileSystem.getInfoAsync(meta.filePath);
      if (!fileInfo.exists) {
        this.metadata.delete(trackId);
        await this._saveMetadata();
        return null;
      }

      // Update last accessed time
      meta.lastAccessedAt = new Date().toISOString();
      await this._saveMetadata();

      return meta.filePath;
    } catch {
      return null;
    }
  }

  /**
   * Check if a track is cached (without updating last accessed time)
   */
  async isTrackCached(trackId: string): Promise<boolean> {
    if (this.isWeb) return false;
    await this.initialize();

    const meta = this.metadata.get(trackId);
    if (!meta) return false;

    try {
      const fileInfo = await FileSystem.getInfoAsync(meta.filePath);
      return fileInfo.exists;
    } catch {
      return false;
    }
  }

  /**
   * Cache a track from a source URL
   * Returns the local file path on success
   */
  async cacheTrack(
    trackId: string,
    retreatId: string,
    sourceUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    if (this.isWeb) return sourceUrl; // On web, just return the stream URL directly
    await this.initialize();

    // Check if already cached
    const existingPath = await this.getCachedTrackPath(trackId);
    if (existingPath) {
      return existingPath;
    }

    const cacheDir = getCacheDir();
    const filePath = `${cacheDir}${trackId}.mp3`;

    console.log(`📥 Caching track ${trackId} to ${filePath}`);

    // Download the file
    const downloadResumable = FileSystem.createDownloadResumable(
      sourceUrl,
      filePath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(progress * 100);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result) {
      throw new Error('Download failed - no result');
    }

    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size || 0 : 0;

    // Validate file isn't an error response
    if (fileSize < 10000) {
      try {
        const content = await FileSystem.readAsStringAsync(result.uri, { length: 200 });
        if (content.includes('<?xml') && content.includes('<Error>')) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
          throw new Error('Received error response instead of audio file');
        }
      } catch {
        // If we can't read it, and it's very small, still suspicious
        if (fileSize < 1000) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
          throw new Error('Downloaded file is suspiciously small');
        }
      }
    }

    // Evict old files if needed (protect the retreat this track belongs to)
    await this._evictIfNeeded(fileSize, retreatId);

    // Store metadata
    const now = new Date().toISOString();
    const metadata: CacheMetadata = {
      trackId,
      retreatId,
      filePath: result.uri,
      fileSize,
      cachedAt: now,
      lastAccessedAt: now,
    };

    this.metadata.set(trackId, metadata);
    await this._saveMetadata();

    console.log(`✅ Cached track ${trackId} (${Math.round(fileSize / 1024 / 1024 * 100) / 100}MB)`);
    return result.uri;
  }

  /**
   * Update the last accessed time for a track (call when playing from cache)
   */
  async updateLastAccessed(trackId: string): Promise<void> {
    await this.initialize();

    const meta = this.metadata.get(trackId);
    if (meta) {
      meta.lastAccessedAt = new Date().toISOString();
      await this._saveMetadata();
    }
  }

  /**
   * Evict cached files if adding newFileSize would exceed the limit
   * Protected retreat's tracks are never evicted
   */
  private async _evictIfNeeded(newFileSize: number, protectedRetreatId?: string): Promise<void> {
    // No limit set
    if (this.settings.maxSizeBytes === 0) return;

    const currentSize = this._calculateTotalSize();
    const targetSize = this.settings.maxSizeBytes;

    if (currentSize + newFileSize <= targetSize) {
      return; // No eviction needed
    }

    // Get all cached files sorted by lastAccessedAt (oldest first)
    const entries = Array.from(this.metadata.values())
      .filter(m => m.retreatId !== protectedRetreatId) // Protect current retreat
      .sort((a, b) => new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime());

    const spaceNeeded = (currentSize + newFileSize) - targetSize;
    let spaceFreed = 0;

    for (const entry of entries) {
      if (spaceFreed >= spaceNeeded) break;

      try {
        await FileSystem.deleteAsync(entry.filePath, { idempotent: true });
        this.metadata.delete(entry.trackId);
        spaceFreed += entry.fileSize;
        console.log(`🗑️ Evicted cached track ${entry.trackId} (${Math.round(entry.fileSize / 1024 / 1024 * 100) / 100}MB)`);
      } catch (error) {
        console.warn(`Failed to evict track ${entry.trackId}:`, error);
      }
    }

    if (spaceFreed > 0) {
      await this._saveMetadata();
      console.log(`📦 Evicted ${Math.round(spaceFreed / 1024 / 1024 * 100) / 100}MB to make room for new cache`);
    }
  }

  /**
   * Calculate total size of all cached files
   */
  private _calculateTotalSize(): number {
    let total = 0;
    for (const meta of this.metadata.values()) {
      total += meta.fileSize;
    }
    return total;
  }

  /**
   * Get cache statistics for UI display
   */
  async getCacheStats(): Promise<CacheStats> {
    await this.initialize();

    const entries = Array.from(this.metadata.values());
    const totalSize = this._calculateTotalSize();

    let oldestTrack: string | undefined;
    let newestTrack: string | undefined;

    if (entries.length > 0) {
      const sorted = entries.sort((a, b) =>
        new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
      );
      oldestTrack = sorted[0].trackId;
      newestTrack = sorted[sorted.length - 1].trackId;
    }

    return {
      totalSize,
      trackCount: entries.length,
      oldestTrack,
      newestTrack,
    };
  }

  /**
   * Clear all cached files
   */
  async clearCache(): Promise<{ freedBytes: number; tracksRemoved: number }> {
    if (this.isWeb) return { freedBytes: 0, tracksRemoved: 0 };
    await this.initialize();

    const stats = {
      freedBytes: this._calculateTotalSize(),
      tracksRemoved: this.metadata.size,
    };

    // Delete all cached files
    for (const meta of this.metadata.values()) {
      try {
        await FileSystem.deleteAsync(meta.filePath, { idempotent: true });
      } catch (error) {
        console.warn(`Failed to delete cached file ${meta.filePath}:`, error);
      }
    }

    // Clear metadata
    this.metadata.clear();
    await this._saveMetadata();

    console.log(`🧹 Cleared cache: ${stats.tracksRemoved} tracks, ${Math.round(stats.freedBytes / 1024 / 1024)}MB`);
    return stats;
  }

  /**
   * Get current cache settings
   */
  async getCacheSettings(): Promise<CacheSettings> {
    await this.initialize();
    return { ...this.settings };
  }

  /**
   * Set cache limit (0 = no limit)
   */
  async setCacheLimit(bytes: number): Promise<void> {
    await this.initialize();

    this.settings.maxSizeBytes = bytes;
    await this._saveSettings();

    // If new limit is lower than current usage, evict immediately
    if (bytes > 0) {
      const currentSize = this._calculateTotalSize();
      if (currentSize > bytes) {
        await this._evictIfNeeded(0); // Evict with 0 new bytes to enforce limit
      }
    }

    console.log(`⚙️ Cache limit set to ${bytes === 0 ? 'No Limit' : `${Math.round(bytes / 1024 / 1024 / 1024 * 100) / 100}GB`}`);
  }

  /**
   * Get all cached track IDs for a specific retreat
   */
  async getCachedTrackIdsForRetreat(retreatId: string): Promise<string[]> {
    await this.initialize();

    return Array.from(this.metadata.values())
      .filter(m => m.retreatId === retreatId)
      .map(m => m.trackId);
  }

  /**
   * Remove a specific track from cache
   */
  async removeFromCache(trackId: string): Promise<boolean> {
    if (this.isWeb) return false;
    await this.initialize();

    const meta = this.metadata.get(trackId);
    if (!meta) return false;

    try {
      await FileSystem.deleteAsync(meta.filePath, { idempotent: true });
      this.metadata.delete(trackId);
      await this._saveMetadata();
      console.log(`🗑️ Removed track ${trackId} from cache`);
      return true;
    } catch (error) {
      console.error(`Failed to remove track ${trackId} from cache:`, error);
      return false;
    }
  }

  /**
   * Pre-cache tracks up to a specified duration (in seconds)
   * Used for lookahead caching - caches upcoming tracks in background
   *
   * @param tracks - Array of tracks with id, duration, and audio_file (stream URL getter)
   * @param retreatId - The retreat these tracks belong to (for LRU protection)
   * @param durationSeconds - Maximum total duration to pre-cache (default: 3600 = 1 hour)
   * @param getStreamUrl - Function to get stream URL for a track ID
   * @returns Promise with count of tracks queued for caching
   */
  async preCacheTracksForDuration(
    tracks: { id: string; duration: number }[],
    retreatId: string,
    getStreamUrl: (trackId: string) => Promise<string | null>,
    durationSeconds: number = 3600
  ): Promise<{ queued: number; skipped: number; totalDuration: number }> {
    if (this.isWeb) return { queued: 0, skipped: 0, totalDuration: 0 };
    await this.initialize();

    let totalDuration = 0;
    let queued = 0;
    let skipped = 0;

    console.log(`🔮 Pre-caching up to ${Math.round(durationSeconds / 60)} minutes of tracks...`);

    for (const track of tracks) {
      // Stop if we've accumulated enough duration
      if (totalDuration >= durationSeconds) {
        console.log(`🔮 Pre-cache target reached: ${Math.round(totalDuration / 60)} minutes queued`);
        break;
      }

      // Skip if already cached
      const isCached = await this.isTrackCached(track.id);
      if (isCached) {
        skipped++;
        totalDuration += track.duration;
        continue;
      }

      // Get stream URL and cache in background
      try {
        const streamUrl = await getStreamUrl(track.id);
        if (streamUrl) {
          // Fire and forget - don't await the actual caching
          this.cacheTrack(track.id, retreatId, streamUrl)
            .then(() => console.log(`🔮 Pre-cached: track ${track.id}`))
            .catch((err) => console.warn(`🔮 Pre-cache failed for ${track.id}:`, err));

          queued++;
          totalDuration += track.duration;
        }
      } catch (error) {
        console.warn(`🔮 Failed to get stream URL for pre-cache: ${track.id}`, error);
      }
    }

    console.log(`🔮 Pre-cache summary: ${queued} queued, ${skipped} already cached, ${Math.round(totalDuration / 60)} min total`);
    return { queued, skipped, totalDuration };
  }
}

export default CacheService.getInstance();
