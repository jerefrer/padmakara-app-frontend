/**
 * Transcript Cache Service
 *
 * Caches watermarked PDF transcripts on device to avoid re-fetching.
 * - Native: files stored in cacheDirectory/transcripts/, metadata in AsyncStorage
 * - Web: in-memory blob URLs (ephemeral, lost on page refresh)
 * - Cache invalidation: based on transcript updatedAt timestamp
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@transcript_cache:metadata';

interface TranscriptCacheEntry {
  transcriptId: string;
  updatedAt: string;
  filePath: string;
  fileSize: number;
  cachedAt: string;
}

// Web-only in-memory cache
const webCache = new Map<string, { blobUrl: string; updatedAt: string }>();

class TranscriptCacheService {
  private isWeb = Platform.OS === 'web';

  /**
   * Get cached transcript URL if available and fresh.
   * Returns file:// URI (native) or blob: URL (web), or null if not cached/stale.
   */
  async getCached(transcriptId: string, updatedAt: string, expectedFilename?: string): Promise<string | null> {
    if (this.isWeb) {
      const entry = webCache.get(transcriptId);
      if (entry && entry.updatedAt === updatedAt) {
        return entry.blobUrl;
      }
      // Stale — revoke old blob URL
      if (entry) {
        URL.revokeObjectURL(entry.blobUrl);
        webCache.delete(transcriptId);
      }
      return null;
    }

    // Native
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const metadata = await this.getMetadata();
      const entry = metadata[transcriptId];

      if (!entry || entry.updatedAt !== updatedAt) {
        // Stale or missing — clean up old file if exists
        if (entry) {
          await FileSystem.deleteAsync(entry.filePath, { idempotent: true }).catch(() => {});
          delete metadata[transcriptId];
          await this.saveMetadata(metadata);
        }
        return null;
      }

      // Invalidate if cached with wrong filename (e.g. "396.pdf" instead of original)
      if (expectedFilename && !entry.filePath.endsWith(expectedFilename)) {
        await FileSystem.deleteAsync(entry.filePath, { idempotent: true }).catch(() => {});
        delete metadata[transcriptId];
        await this.saveMetadata(metadata);
        return null;
      }

      // Verify file still exists
      const info = await FileSystem.getInfoAsync(entry.filePath);
      if (!info.exists) {
        delete metadata[transcriptId];
        await this.saveMetadata(metadata);
        return null;
      }

      return entry.filePath;
    } catch (err) {
      console.error('Transcript cache read error:', err);
      return null;
    }
  }

  /**
   * Cache a watermarked PDF. Returns the local URL to use for viewing.
   */
  async cache(transcriptId: string, updatedAt: string, pdfBytes: ArrayBuffer, filename?: string): Promise<string> {
    if (this.isWeb) {
      // Revoke any previous blob URL
      const old = webCache.get(transcriptId);
      if (old) URL.revokeObjectURL(old.blobUrl);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      webCache.set(transcriptId, { blobUrl, updatedAt });
      return blobUrl;
    }

    // Native
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const cacheDir = `${FileSystem.cacheDirectory}transcripts/`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      // Use original filename if available, fall back to transcriptId
      const safeFilename = filename || `${transcriptId}.pdf`;
      const filePath = `${cacheDir}${safeFilename}`;

      // Convert ArrayBuffer to base64 and write
      const base64 = arrayBufferToBase64(pdfBytes);
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Update metadata
      const metadata = await this.getMetadata();
      metadata[transcriptId] = {
        transcriptId,
        updatedAt,
        filePath,
        fileSize: pdfBytes.byteLength,
        cachedAt: new Date().toISOString(),
      };
      await this.saveMetadata(metadata);

      return filePath;
    } catch (err) {
      console.error('Transcript cache write error:', err);
      throw err;
    }
  }

  /**
   * Get the file path for a cached transcript (for sharing/downloading on native).
   * Returns null if not cached.
   */
  async getCachedFilePath(transcriptId: string): Promise<string | null> {
    if (this.isWeb) return null;

    try {
      const metadata = await this.getMetadata();
      const entry = metadata[transcriptId];
      if (!entry) return null;

      const FileSystem = await import('expo-file-system/legacy');
      const info = await FileSystem.getInfoAsync(entry.filePath);
      return info.exists ? entry.filePath : null;
    } catch {
      return null;
    }
  }

  /**
   * Clear all cached transcripts.
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
      const cacheDir = `${FileSystem.cacheDirectory}transcripts/`;
      await FileSystem.deleteAsync(cacheDir, { idempotent: true }).catch(() => {});
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Transcript cache clear error:', err);
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
      const metadata = await this.getMetadata();
      const entries = Object.values(metadata);
      const totalSize = entries.reduce((sum, e) => sum + (e.fileSize || 0), 0);
      return { totalSize, count: entries.length };
    } catch {
      return { totalSize: 0, count: 0 };
    }
  }

  private async getMetadata(): Promise<Record<string, TranscriptCacheEntry>> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private async saveMetadata(metadata: Record<string, TranscriptCacheEntry>): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
  }
}

/** Convert ArrayBuffer to base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const transcriptCacheService = new TranscriptCacheService();
