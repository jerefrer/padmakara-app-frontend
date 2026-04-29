/**
 * Video download service — explicit, user-initiated offline downloads.
 *
 * This is intentionally separate from the audio retreat-ZIP download flow:
 *   - Each video is a single MP4 fetched per-session from Bunny Stream.
 *   - The user explicitly taps "Save offline" — we never auto-download videos
 *     because they're 1-3 GB each.
 *   - Files live in document storage (`videos/` directory) so they survive
 *     OS cache pressure. Audio cache uses `cacheDirectory` because audio
 *     files are small and cheap to re-download.
 *
 * Videos are session-scoped: one session can have one video. The session ID
 * is the cache key for local storage.
 */

import { API_ENDPOINTS } from '@/services/apiConfig';
import apiService from '@/services/apiService';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const VIDEO_DIR = `${FileSystem.documentDirectory}videos/`;

export type VideoDownloadStatus =
  | { state: 'idle' }
  | { state: 'downloading'; progress: number; bytesDownloaded: number; bytesTotal: number }
  | { state: 'done'; localUri: string; size: number }
  | { state: 'error'; message: string };

/** Local file path for a downloaded session video. */
function videoFilePath(sessionId: string): string {
  return `${VIDEO_DIR}session-${sessionId}.mp4`;
}

async function ensureVideoDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VIDEO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
  }
}

class VideoDownloadService {
  /** Active downloads, by sessionId — exposed so the UI can cancel them. */
  private active = new Map<string, FileSystem.DownloadResumable>();

  /** Local URI if the session video is already downloaded; null otherwise. */
  async getLocalUri(sessionId: string): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      const path = videoFilePath(sessionId);
      const info = await FileSystem.getInfoAsync(path);
      return info.exists ? path : null;
    } catch {
      return null;
    }
  }

  async isDownloaded(sessionId: string): Promise<boolean> {
    return (await this.getLocalUri(sessionId)) !== null;
  }

  /**
   * Download a session video to local storage. Resolves with the local file
   * URI on success. Reports progress via the callback. Throws on cancel/error.
   */
  async download(
    sessionId: string,
    quality: '240p' | '360p' | '480p' | '720p' | '1080p' = '720p',
    onProgress?: (status: VideoDownloadStatus) => void,
  ): Promise<string> {
    if (Platform.OS === 'web') {
      throw new Error('Video downloads are not supported on web');
    }
    await ensureVideoDir();

    // Already downloaded? Return immediately.
    const existing = await this.getLocalUri(sessionId);
    if (existing) {
      onProgress?.({ state: 'done', localUri: existing, size: 0 });
      return existing;
    }

    // 1. Ask the backend for a signed MP4 download URL.
    const response = await apiService.get<{ url: string; quality: string; expiresAt: number }>(
      `${API_ENDPOINTS.VIDEO_SESSION_DOWNLOAD_URL(sessionId)}?quality=${quality}`,
    );
    if (!response.success || !response.data?.url) {
      throw new Error(response.error || 'Failed to get download URL');
    }

    const path = videoFilePath(sessionId);
    const downloadResumable = FileSystem.createDownloadResumable(
      response.data.url,
      path,
      {},
      (p) => {
        const total = p.totalBytesExpectedToWrite || 0;
        const written = p.totalBytesWritten || 0;
        onProgress?.({
          state: 'downloading',
          progress: total > 0 ? written / total : 0,
          bytesDownloaded: written,
          bytesTotal: total,
        });
      },
    );

    this.active.set(sessionId, downloadResumable);
    try {
      const result = await downloadResumable.downloadAsync();
      if (!result) {
        throw new Error('Download cancelled');
      }
      const info = await FileSystem.getInfoAsync(result.uri);
      const size = info.exists && 'size' in info ? info.size || 0 : 0;
      onProgress?.({ state: 'done', localUri: result.uri, size });
      return result.uri;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      onProgress?.({ state: 'error', message });
      throw err;
    } finally {
      this.active.delete(sessionId);
    }
  }

  /** Cancel an in-flight download (best-effort). The partial file is removed. */
  async cancel(sessionId: string): Promise<void> {
    const active = this.active.get(sessionId);
    if (active) {
      try {
        await active.pauseAsync();
      } catch {
        // ignore
      }
      this.active.delete(sessionId);
    }
    await this.delete(sessionId);
  }

  /** Remove a downloaded session video from local storage. */
  async delete(sessionId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const path = videoFilePath(sessionId);
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    } catch {
      // ignore
    }
  }

  /** Total bytes used by downloaded videos. */
  async getTotalSize(): Promise<number> {
    if (Platform.OS === 'web') return 0;
    try {
      const info = await FileSystem.getInfoAsync(VIDEO_DIR);
      if (!info.exists) return 0;
      const files = await FileSystem.readDirectoryAsync(VIDEO_DIR);
      let total = 0;
      for (const name of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${VIDEO_DIR}${name}`);
        if (fileInfo.exists && 'size' in fileInfo) total += fileInfo.size || 0;
      }
      return total;
    } catch {
      return 0;
    }
  }
}

export const videoDownloadService = new VideoDownloadService();
export default videoDownloadService;
