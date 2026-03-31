/**
 * Publication Service
 *
 * Handles fetching publications, PDF downloads with caching, and reading position persistence.
 * - Native: PDFs stored in documentDirectory/publications/, metadata in AsyncStorage
 * - Web: in-memory blob URLs (ephemeral, lost on page refresh)
 * - Cache invalidation: based on publication updatedAt timestamp
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, API_ENDPOINTS, buildApiUrl, getAuthHeaders } from './apiConfig';
import type { Publication } from '../types';

const CACHE_METADATA_KEY = '@publication_cache:metadata';
const POSITION_KEY_PREFIX = '@publication_position:';

interface PublicationCacheEntry {
  publicationId: string;
  updatedAt: string;
  filePath: string;
  fileSize: number;
  cachedAt: string;
}

// Web-only in-memory cache
const webCache = new Map<string, { blobUrl: string; updatedAt: string }>();

class PublicationService {
  private isWeb = Platform.OS === 'web';

  /**
   * Fetch list of publications from the API.
   * Works with or without authentication (public publications are always visible).
   */
  async getPublications(sort?: string, language?: string): Promise<Publication[]> {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (language) params.set('language', language);

    const query = params.toString();
    const url = buildApiUrl(API_ENDPOINTS.PUBLICATIONS + (query ? `?${query}` : ''));

    let headers: Record<string, string> = { ...API_CONFIG.headers };
    try {
      headers = await getAuthHeaders();
    } catch {
      // No auth token — proceed without authorization (public publications only)
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch publications: ${response.status}`);
    }

    const data = await response.json();
    return data.data ?? data;
  }

  /**
   * Get a presigned PDF download URL for a publication (auth required).
   */
  async getPdfUrl(publicationId: string): Promise<string> {
    const url = buildApiUrl(API_ENDPOINTS.PUBLICATION_PDF(publicationId));
    const headers = await getAuthHeaders();

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to get PDF URL: ${response.status}`);
    }

    const data = await response.json();
    return data.url;
  }

  /**
   * Get cached PDF URL if available and fresh.
   * Returns file:// URI (native) or blob: URL (web), or null if not cached/stale.
   */
  async getCachedPdf(publicationId: string, updatedAt: string): Promise<string | null> {
    if (this.isWeb) {
      const entry = webCache.get(publicationId);
      if (entry && entry.updatedAt === updatedAt) {
        return entry.blobUrl;
      }
      // Stale — revoke old blob URL
      if (entry) {
        URL.revokeObjectURL(entry.blobUrl);
        webCache.delete(publicationId);
      }
      return null;
    }

    // Native
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const metadata = await this.getCacheMetadata();
      const entry = metadata[publicationId];

      if (!entry || entry.updatedAt !== updatedAt) {
        // Stale or missing — clean up old file if exists
        if (entry) {
          await FileSystem.deleteAsync(entry.filePath, { idempotent: true }).catch(() => {});
          delete metadata[publicationId];
          await this.saveCacheMetadata(metadata);
        }
        return null;
      }

      // Verify file still exists
      const info = await FileSystem.getInfoAsync(entry.filePath);
      if (!info.exists) {
        delete metadata[publicationId];
        await this.saveCacheMetadata(metadata);
        return null;
      }

      return entry.filePath;
    } catch (err) {
      console.error('Publication cache read error:', err);
      return null;
    }
  }

  /**
   * Download and cache a publication PDF. Returns the local URL to use for viewing.
   */
  async downloadAndCachePdf(
    publicationId: string,
    updatedAt: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const pdfUrl = await this.getPdfUrl(publicationId);

    if (this.isWeb) {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`PDF download failed: ${response.status}`);

      const pdfBytes = await response.arrayBuffer();

      // Revoke any previous blob URL
      const old = webCache.get(publicationId);
      if (old) URL.revokeObjectURL(old.blobUrl);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      webCache.set(publicationId, { blobUrl, updatedAt });

      onProgress?.(1);
      return blobUrl;
    }

    // Native — use expo-file-system downloadAsync with resume support
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const cacheDir = `${FileSystem.documentDirectory}publications/`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      const filePath = `${cacheDir}${publicationId}.pdf`;

      // Use createDownloadResumable for progress tracking
      if (onProgress) {
        const downloadResumable = FileSystem.createDownloadResumable(
          pdfUrl,
          filePath,
          {},
          (downloadProgress) => {
            const progress =
              downloadProgress.totalBytesExpectedToWrite > 0
                ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
                : 0;
            onProgress(progress);
          },
        );

        const result = await downloadResumable.downloadAsync();
        if (!result) throw new Error('Download returned no result');
      } else {
        await FileSystem.downloadAsync(pdfUrl, filePath);
      }

      // Verify download
      const info = await FileSystem.getInfoAsync(filePath);
      if (!info.exists) throw new Error('Downloaded file not found');

      // Update metadata
      const metadata = await this.getCacheMetadata();
      metadata[publicationId] = {
        publicationId,
        updatedAt,
        filePath,
        fileSize: (info as { size?: number }).size ?? 0,
        cachedAt: new Date().toISOString(),
      };
      await this.saveCacheMetadata(metadata);

      return filePath;
    } catch (err) {
      console.error('Publication PDF download error:', err);
      throw err;
    }
  }

  /**
   * Get saved reading position for a publication.
   */
  async getReadingPosition(publicationId: string): Promise<number | null> {
    try {
      const raw = await AsyncStorage.getItem(`${POSITION_KEY_PREFIX}${publicationId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save reading position for a publication.
   */
  async saveReadingPosition(publicationId: string, page: number): Promise<void> {
    await AsyncStorage.setItem(`${POSITION_KEY_PREFIX}${publicationId}`, JSON.stringify(page));
  }

  /**
   * Clear all cached publication PDFs.
   */
  async clearCache(): Promise<void> {
    if (this.isWeb) {
      for (const entry of webCache.values()) {
        URL.revokeObjectURL(entry.blobUrl);
      }
      webCache.clear();
      return;
    }

    try {
      const FileSystem = await import('expo-file-system/legacy');
      const cacheDir = `${FileSystem.documentDirectory}publications/`;
      await FileSystem.deleteAsync(cacheDir, { idempotent: true }).catch(() => {});
      await AsyncStorage.removeItem(CACHE_METADATA_KEY);
    } catch (err) {
      console.error('Publication cache clear error:', err);
    }
  }

  /**
   * Get cache stats for settings UI.
   */
  async getCacheStats(): Promise<{ totalSize: number; count: number }> {
    if (this.isWeb) {
      return { totalSize: 0, count: webCache.size };
    }

    try {
      const metadata = await this.getCacheMetadata();
      const entries = Object.values(metadata);
      const totalSize = entries.reduce((sum, e) => sum + (e.fileSize || 0), 0);
      return { totalSize, count: entries.length };
    } catch {
      return { totalSize: 0, count: 0 };
    }
  }

  private async getCacheMetadata(): Promise<Record<string, PublicationCacheEntry>> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private async saveCacheMetadata(metadata: Record<string, PublicationCacheEntry>): Promise<void> {
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  }
}

export const publicationService = new PublicationService();
