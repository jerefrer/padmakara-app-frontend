import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProgress, Bookmark, PDFProgress } from '@/types';
import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';

interface RemoteVideoProgress {
  positionSeconds: number;
  durationSeconds: number | null;
  completedAt: string | null;
  updatedAt: string | null;
}

interface RemoteAudioProgress {
  // `trackId` is present in the bulk-list endpoint response (/content/progress);
  // absent from the per-track endpoint (/content/progress/:trackId) since the
  // caller already knows it.
  trackId?: number;
  positionSeconds: number;
  durationSeconds?: number | null;
  completionPct: number;
  isCompleted: boolean;
  lastPlayed: string | null;
}

interface RemoteLastPlayedTrackPayload {
  trackId: number;
  positionSeconds: number;
  durationSeconds: number | null;
  isCompleted: boolean;
  lastPlayed: string;
  track: any;
  session: any;
  event: { id: number; titleEn?: string; titlePt?: string; name?: string };
}

interface RemoteLastPlayedTrack {
  trackId: string;
  positionSeconds: number;
  lastPlayed: string;
  track: any;
  meta: { retreatId: string; retreatName: string; groupName: string };
}

class ProgressService {
  private static instance: ProgressService;
  
  static getInstance(): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService();
    }
    return ProgressService.instance;
  }

  // Progress Management
  async saveProgress(progress: UserProgress): Promise<void> {
    try {
      const key = `progress_${progress.trackId}`;
      await AsyncStorage.setItem(key, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }

  async getProgress(trackId: string): Promise<UserProgress | null> {
    try {
      const key = `progress_${trackId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting progress:', error);
      return null;
    }
  }

  async getAllProgress(): Promise<UserProgress[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const progressKeys = keys.filter(key => key.startsWith('progress_'));
      const progressData = await AsyncStorage.multiGet(progressKeys);
      
      return progressData
        .map(([_, value]) => value ? JSON.parse(value) : null)
        .filter(Boolean);
    } catch (error) {
      console.error('Error getting all progress:', error);
      return [];
    }
  }

  async deleteProgress(trackId: string): Promise<void> {
    try {
      const key = `progress_${trackId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error deleting progress:', error);
    }
  }

  // Bookmark Management
  async saveBookmarks(trackId: string, bookmarks: Bookmark[]): Promise<void> {
    try {
      const key = `bookmarks_${trackId}`;
      await AsyncStorage.setItem(key, JSON.stringify(bookmarks));
    } catch (error) {
      console.error('Error saving bookmarks:', error);
    }
  }

  async getBookmarks(trackId: string): Promise<Bookmark[]> {
    try {
      const key = `bookmarks_${trackId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting bookmarks:', error);
      return [];
    }
  }

  async addBookmark(bookmark: Bookmark): Promise<void> {
    try {
      const existingBookmarks = await this.getBookmarks(bookmark.trackId);
      const updatedBookmarks = [...existingBookmarks, bookmark];
      await this.saveBookmarks(bookmark.trackId, updatedBookmarks);
    } catch (error) {
      console.error('Error adding bookmark:', error);
    }
  }

  async deleteBookmark(trackId: string, bookmarkId: string): Promise<void> {
    try {
      const existingBookmarks = await this.getBookmarks(trackId);
      const updatedBookmarks = existingBookmarks.filter(b => b.id !== bookmarkId);
      await this.saveBookmarks(trackId, updatedBookmarks);
    } catch (error) {
      console.error('Error deleting bookmark:', error);
    }
  }

  // Statistics
  async getListeningStats(): Promise<{
    totalTracks: number;
    completedTracks: number;
    totalListeningTime: number; // in seconds
    averageProgress: number; // percentage
  }> {
    try {
      const allProgress = await this.getAllProgress();
      
      const totalTracks = allProgress.length;
      const completedTracks = allProgress.filter(p => p.completed).length;
      const totalListeningTime = allProgress.reduce((sum, p) => sum + p.position, 0);
      const averageProgress = totalTracks > 0 
        ? allProgress.reduce((sum, p) => sum + (p.position / 3600), 0) / totalTracks * 100 
        : 0; // Rough estimate assuming 1 hour average track length

      return {
        totalTracks,
        completedTracks,
        totalListeningTime,
        averageProgress: Math.min(averageProgress, 100),
      };
    } catch (error) {
      console.error('Error getting listening stats:', error);
      return {
        totalTracks: 0,
        completedTracks: 0,
        totalListeningTime: 0,
        averageProgress: 0,
      };
    }
  }

  // Recent Activity
  async getRecentActivity(limit: number = 5): Promise<UserProgress[]> {
    try {
      const allProgress = await this.getAllProgress();
      
      return allProgress
        .filter(p => p.lastPlayed)
        .sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  // Continue Listening (tracks with progress but not completed)
  async getContinueListening(limit: number = 3): Promise<UserProgress[]> {
    try {
      const allProgress = await this.getAllProgress();
      
      return allProgress
        .filter(p => p.position > 30 && !p.completed) // Started listening (>30s) but not completed
        .sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting continue listening:', error);
      return [];
    }
  }

  // PDF Progress Management
  async savePDFProgress(progress: PDFProgress): Promise<void> {
    try {
      const key = `pdf_progress_${progress.transcriptId}`;
      await AsyncStorage.setItem(key, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving PDF progress:', error);
    }
  }

  async getPDFProgress(transcriptId: string): Promise<PDFProgress | null> {
    try {
      const key = `pdf_progress_${transcriptId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting PDF progress:', error);
      return null;
    }
  }

  async getAllPDFProgress(): Promise<PDFProgress[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pdfProgressKeys = keys.filter(key => key.startsWith('pdf_progress_'));
      const progressData = await AsyncStorage.multiGet(pdfProgressKeys);
      
      return progressData
        .map(([_, value]) => value ? JSON.parse(value) : null)
        .filter(Boolean);
    } catch (error) {
      console.error('Error getting all PDF progress:', error);
      return [];
    }
  }

  // Clear all progress and bookmark data
  async clearAllData(): Promise<{ success: boolean; removedCount: number; error?: string }> {
    try {
      console.log('🧹 Clearing all progress and bookmark data...');
      
      const keys = await AsyncStorage.getAllKeys();
      const progressKeys = keys.filter(key => 
        key.startsWith('progress_') || 
        key.startsWith('bookmarks_') || 
        key.startsWith('pdf_progress_')
      );
      
      if (progressKeys.length > 0) {
        await AsyncStorage.multiRemove(progressKeys);
        console.log(`✅ Cleared ${progressKeys.length} progress and bookmark items`);
        return { success: true, removedCount: progressKeys.length };
      } else {
        console.log('ℹ️ No progress or bookmark data found to clear');
        return { success: true, removedCount: 0 };
      }
    } catch (error) {
      console.error('Error clearing all progress data:', error);
      return { 
        success: false, 
        removedCount: 0, 
        error: 'Failed to clear progress data. Please try again.' 
      };
    }
  }

  // Sync with backend (placeholder for future AWS integration)
  // ─── Audio Progress (cross-device, track-scoped) ───
  //
  // Mirrors the video-progress methods below but talks to the existing
  // /content/progress endpoints. Track IDs come into the app as strings
  // (Track.id) but the backend body schema expects an integer, so we coerce
  // on POST. Best-effort fire-and-forget; playback never breaks if the
  // network is unavailable.

  async saveAudioProgressRemote(
    trackId: string,
    positionSeconds: number,
    durationSeconds: number,
    completed: boolean,
  ): Promise<void> {
    try {
      const numericId = parseInt(trackId, 10);
      if (Number.isNaN(numericId)) return;
      const res = await apiService.post<{ skipped?: boolean; reason?: string }>(
        API_ENDPOINTS.USER_PROGRESS,
        {
          trackId: numericId,
          positionSeconds: Math.floor(positionSeconds),
          durationSeconds: durationSeconds > 0 ? Math.floor(durationSeconds) : undefined,
        },
      );
      // Server returns 200 + { skipped: true } when the trackId doesn't
      // exist in the tracks table — happens for orphaned local entries
      // (old DB seeds, deleted tracks, env switches). Clean up the local
      // entry so we don't keep retrying the same skipped push every cold
      // start. (We use 200 + marker rather than 404 so the browser DevTools
      // network panel doesn't log a red error every time.)
      if (res.success && res.data && (res.data as any).skipped) {
        // eslint-disable-next-line no-console
        console.warn(`saveAudioProgressRemote: track ${trackId} unknown to server — deleting orphaned local entry.`);
        await this.deleteProgress(trackId);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('saveAudioProgressRemote failed (will retry on next save):', error);
    }
    // Suppress unused-parameter warning — `completed` is part of the public
    // signature for parity with saveVideoProgressRemote, even though the
    // backend computes isCompleted itself.
    void completed;
  }

  async getAudioProgressRemote(trackId: string): Promise<RemoteAudioProgress | null> {
    try {
      const res = await apiService.get<RemoteAudioProgress>(
        API_ENDPOINTS.TRACK_PROGRESS(trackId),
      );
      if (!res.success || !res.data) return null;
      // Backend returns { positionSeconds: 0, completionPct: 0, isCompleted: false }
      // (no `lastPlayed`) when no row exists. Treat that as "no remote record"
      // so callers can fall back to local.
      if (!res.data.lastPlayed) return null;
      return res.data;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('getAudioProgressRemote failed:', error);
      return null;
    }
  }

  /**
   * Bulk fetch every audio-progress row for the current user. Used by the
   * AudioPlayerContext on mount + foreground resume to seed the in-memory
   * cache and merge with local AsyncStorage state. Returns [] on any
   * network error so the caller can fall back to local.
   *
   * Filters out rows with no `lastPlayed` (defensive — the backend
   * shouldn't return such rows from this endpoint, but the per-track
   * endpoint does for missing rows, and we share the same response type).
   */
  async getAllAudioProgressRemote(): Promise<RemoteAudioProgress[]> {
    try {
      const res = await apiService.get<RemoteAudioProgress[]>(
        API_ENDPOINTS.USER_PROGRESS,
      );
      if (!res.success || !Array.isArray(res.data)) return [];
      return res.data.filter((r) => r.lastPlayed);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('getAllAudioProgressRemote failed:', error);
      return [];
    }
  }

  async getLastPlayedTrackRemote(): Promise<RemoteLastPlayedTrack | null> {
    try {
      const res = await apiService.get<RemoteLastPlayedTrackPayload | null>(
        '/content/last-played',
      );
      if (!res.success || !res.data) return null;
      const { trackId, positionSeconds, lastPlayed, track, event } = res.data;
      if (!track || !event) return null;
      return {
        trackId: String(trackId),
        positionSeconds,
        lastPlayed,
        track,
        meta: {
          retreatId: String(event.id),
          retreatName: event.titleEn || event.titlePt || event.name || '',
          groupName: '',
        },
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('getLastPlayedTrackRemote failed:', error);
      return null;
    }
  }

  // ─── Video Progress (cross-device, session-scoped) ───
  //
  // The native track-progress endpoint is keyed by integer track_id and
  // doesn't fit videos (which live on sessions). We hit a separate
  // `/content/video-progress/:sessionId` endpoint and mirror it locally
  // through the same UserProgress AsyncStorage key the VideoPlayer was
  // already using, so offline reads keep working unchanged.

  /**
   * Save the user's current video position to the backend. Best-effort
   * fire-and-forget — on network failure the local copy still has it.
   */
  async saveVideoProgressRemote(
    sessionId: string,
    positionSeconds: number,
    durationSeconds: number,
    completed: boolean,
  ): Promise<void> {
    try {
      await apiService.post(API_ENDPOINTS.VIDEO_PROGRESS(sessionId), {
        positionSeconds: Math.floor(positionSeconds),
        durationSeconds: durationSeconds > 0 ? Math.floor(durationSeconds) : undefined,
        completed,
      });
    } catch (error) {
      // Don't surface errors — playback must never break because the
      // sync server is unreachable.
      // eslint-disable-next-line no-console
      console.warn('saveVideoProgressRemote failed (will retry on next save):', error);
    }
  }

  /**
   * Fetch the latest server-side video progress. Returns null if no row
   * exists, the request fails, or the response is malformed.
   */
  async getVideoProgressRemote(sessionId: string): Promise<RemoteVideoProgress | null> {
    try {
      const res = await apiService.get<RemoteVideoProgress>(
        API_ENDPOINTS.VIDEO_PROGRESS(sessionId),
      );
      if (!res.success || !res.data) return null;
      // updatedAt is null when the user has never saved progress server-side.
      if (!res.data.updatedAt) return null;
      return res.data;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('getVideoProgressRemote failed:', error);
      return null;
    }
  }
}

export default ProgressService.getInstance();