/**
 * Video download service — explicit, user-initiated offline downloads.
 *
 * This is intentionally separate from the audio retreat-ZIP download flow:
 *   - Each video is a single MP4 fetched from Bunny Stream, keyed by its
 *     EventVideo id.
 *   - The user explicitly taps "Save offline" — we never auto-download videos
 *     because they're 1-3 GB each.
 *   - Files live in document storage (`videos/` directory) so they survive
 *     OS cache pressure. Audio cache uses `cacheDirectory` because audio
 *     files are small and cheap to re-download.
 *
 * Videos are event-scoped: one EventVideo is one MP4 file. The video's id
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

/** Local file path for a downloaded event video. */
function videoFilePath(videoId: number): string {
  return `${VIDEO_DIR}video-${videoId}.mp4`;
}

async function ensureVideoDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VIDEO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
  }
}

let legacyCleanupAttempted = false;

/**
 * One-time migration: delete old session-keyed video downloads
 * (`session-*.mp4`). These were downloaded through the now-removed
 * `/media/video/session/:sessionId/download` route, which never actually
 * existed on the backend — so any such file is orphaned and unplayable.
 * Best-effort; runs once per app process.
 */
async function cleanupLegacyFiles(): Promise<void> {
  if (legacyCleanupAttempted || Platform.OS === 'web') return;
  legacyCleanupAttempted = true;
  try {
    const info = await FileSystem.getInfoAsync(VIDEO_DIR);
    if (!info.exists) return;
    const files = await FileSystem.readDirectoryAsync(VIDEO_DIR);
    for (const name of files) {
      if (name.startsWith('session-') && name.endsWith('.mp4')) {
        await FileSystem.deleteAsync(`${VIDEO_DIR}${name}`, { idempotent: true });
      }
    }
  } catch {
    // Best-effort — a failed cleanup just leaves the orphaned file in place.
  }
}

class VideoDownloadService {
  /** Active downloads, by videoId — exposed so the UI can cancel them. */
  private active = new Map<number, FileSystem.DownloadResumable>();

  /** Local URI if the event video is already downloaded; null otherwise. */
  async getLocalUri(videoId: number): Promise<string | null> {
    await cleanupLegacyFiles();
    if (Platform.OS === 'web') return null;
    try {
      const path = videoFilePath(videoId);
      const info = await FileSystem.getInfoAsync(path);
      return info.exists ? path : null;
    } catch {
      return null;
    }
  }

  async isDownloaded(videoId: number): Promise<boolean> {
    return (await this.getLocalUri(videoId)) !== null;
  }

  /**
   * Download an event video to local storage. Resolves with the local file
   * URI on success. Reports progress via the callback. Throws on cancel/error.
   */
  async download(
    videoId: number,
    quality: '240p' | '360p' | '480p' | '720p' | '1080p' = '720p',
    onProgress?: (status: VideoDownloadStatus) => void,
  ): Promise<string> {
    if (Platform.OS === 'web') {
      throw new Error('Video downloads are not supported on web');
    }
    await ensureVideoDir();

    // Already downloaded? Return immediately.
    const existing = await this.getLocalUri(videoId);
    if (existing) {
      onProgress?.({ state: 'done', localUri: existing, size: 0 });
      return existing;
    }

    // 1. Ask the backend for a signed MP4 download URL.
    const response = await apiService.get<{ url: string; quality: string; expiresAt: number }>(
      `${API_ENDPOINTS.VIDEO_DOWNLOAD_URL(videoId)}?quality=${quality}`,
    );
    if (!response.success || !response.data?.url) {
      throw new Error(response.error || 'Failed to get download URL');
    }

    const path = videoFilePath(videoId);
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

    this.active.set(videoId, downloadResumable);
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
      this.active.delete(videoId);
    }
  }

  /** Cancel an in-flight download (best-effort). The partial file is removed. */
  async cancel(videoId: number): Promise<void> {
    const active = this.active.get(videoId);
    if (active) {
      try {
        await active.pauseAsync();
      } catch {
        // ignore
      }
      this.active.delete(videoId);
    }
    await this.delete(videoId);
  }

  /** Remove a downloaded event video from local storage. */
  async delete(videoId: number): Promise<void> {
    if (Platform.OS === 'web') return;
    const path = videoFilePath(videoId);
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
