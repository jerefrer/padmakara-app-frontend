import { Platform } from 'react-native';
import { Gathering, RetreatGroup, Session, Track, SearchResponse } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { API_CONFIG, API_ENDPOINTS, PaginatedResponse } from './apiConfig';
import apiService from './apiService';

interface UserRetreatData {
  retreat_groups: RetreatGroup[];
  recent_gatherings: Gathering[];
  total_stats: {
    total_groups: number;
    total_gatherings: number;
    total_tracks: number;
    completed_tracks: number;
  };
}

interface RetreatGroupDetails extends RetreatGroup {
  gatherings: Gathering[];
  is_member: boolean;
}

interface GatheringDetails extends Gathering {
  sessions: Session[];
  retreat_group: {
    id: string;
    name: string;
  };
}

interface SessionDetails extends Session {
  tracks: Track[];
  gathering: {
    id: string;
    name: string;
  };
}

// ─── Backend → Frontend Type Mappers ────────────────────────────────

/** Map backend retreatGroup → frontend RetreatGroup */
function mapGroup(backend: any, gatherings?: Gathering[]): RetreatGroup {
  return {
    id: String(backend.id),
    name: backend.nameEn || backend.name_en || '',
    name_translations: {
      en: backend.nameEn || backend.name_en || '',
      ...(backend.namePt || backend.name_pt
        ? { pt: backend.namePt || backend.name_pt }
        : {}),
    },
    abbreviation: backend.abbreviation || '',
    gatherings: gatherings || [],
    created_at: backend.createdAt || backend.created_at || '',
    updated_at: backend.updatedAt || backend.updated_at || '',
  };
}

/** Derive season from a date string */
function deriveSeason(dateStr: string): 'spring' | 'fall' {
  if (!dateStr) return 'spring';
  const month = new Date(dateStr).getMonth() + 1;
  return month >= 3 && month <= 8 ? 'spring' : 'fall';
}

/** Map backend event status to frontend Gathering status */
function mapEventStatus(
  status: string,
  startDate: string,
  endDate: string,
): 'draft' | 'upcoming' | 'ongoing' | 'completed' {
  if (status === 'draft') return 'draft';
  if (status === 'archived') return 'completed';

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'ongoing';
  return 'completed';
}

/** Map backend event → frontend Gathering */
function mapEvent(backend: any): Gathering {
  const startDate = backend.startDate || backend.start_date || '';
  const endDate = backend.endDate || backend.end_date || '';

  return {
    id: String(backend.id),
    name: backend.titleEn || backend.title_en || '',
    name_translations: {
      en: backend.titleEn || backend.title_en || '',
      ...(backend.titlePt || backend.title_pt
        ? { pt: backend.titlePt || backend.title_pt }
        : {}),
    },
    main_topics_translations: {
      ...(backend.mainThemesEn ? { en: backend.mainThemesEn } : {}),
      ...(backend.mainThemesPt ? { pt: backend.mainThemesPt } : {}),
    },
    season: deriveSeason(startDate),
    year: startDate ? new Date(startDate).getFullYear() : 0,
    startDate,
    endDate,
    sessions: backend.sessions?.map(mapSession) || undefined,
    teachers: backend.eventTeachers?.map((et: any) => ({
      name: et.teacher?.name || '',
      abbreviation: et.teacher?.abbreviation || '',
      photoUrl: et.teacher?.photoUrl || null,
    })).filter((t: any) => t.name) || undefined,
    status: mapEventStatus(backend.status || 'published', startDate, endDate),
    created_at: backend.createdAt || '',
    updated_at: backend.updatedAt || '',
  };
}

/** Map backend session → frontend Session */
function mapSession(backend: any): Session {
  return {
    id: String(backend.id),
    name: backend.titleEn || backend.title_en || `Session ${backend.sessionNumber || backend.session_number || ''}`,
    name_translations: {
      en: backend.titleEn || backend.title_en || `Session ${backend.sessionNumber || ''}`,
      ...(backend.titlePt || backend.title_pt
        ? { pt: backend.titlePt || backend.title_pt }
        : {}),
    },
    type: (backend.timePeriod || backend.time_period || 'other') as Session['type'],
    partNumber: backend.partNumber ?? backend.part_number ?? null,
    date: backend.sessionDate || backend.session_date || '',
    tracks: backend.tracks?.map(mapTrack) || undefined,
    gathering_id: String(backend.eventId || backend.event_id || backend.retreat_id || ''),
    created_at: backend.createdAt || '',
    updated_at: backend.updatedAt || '',
  };
}

/** Map backend track → frontend Track */
function mapTrack(backend: any): Track {
  return {
    id: String(backend.id),
    title: backend.title || '',
    duration: backend.durationSeconds || backend.duration_seconds || 0,
    file_size: backend.fileSizeBytes || backend.file_size_bytes || undefined,
    order: backend.trackNumber || backend.track_number || 0,
    session_id: String(backend.sessionId || backend.session_id || ''),
    language: backend.originalLanguage || backend.original_language || backend.language || undefined,
    languages: backend.languages || (backend.originalLanguage ? [backend.originalLanguage] : undefined),
    originalLanguage: backend.originalLanguage || backend.original_language || backend.language || undefined,
    speaker: backend.speaker || undefined,
    speakerName: backend.speakerName || backend.speaker_name || undefined,
    isOriginal: backend.isTranslation != null ? !backend.isTranslation :
                backend.is_translation != null ? !backend.is_translation : undefined,
    isPractice: backend.isPractice ?? backend.is_practice ?? undefined,
    hasReadAlong: backend.hasReadAlong ?? backend.has_read_along ?? false,
    created_at: backend.createdAt || '',
    updated_at: backend.updatedAt || '',
  };
}

// ─── Service ────────────────────────────────────────────────────────

class RetreatService {
  private static instance: RetreatService;
  private readonly CACHE_KEYS = {
    USER_RETREATS: '@retreat_cache:user_retreats',
    GATHERING_DETAILS: '@retreat_cache:gathering_',
    RETREAT_GROUP_DETAILS: '@retreat_cache:group_',
  };
  private readonly CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours
  private activeDownloads = new Map<string, FileSystem.DownloadResumable>();
  private cancelledDownloads = new Set<string>();

  static getInstance(): RetreatService {
    if (!RetreatService.instance) {
      RetreatService.instance = new RetreatService();
    }
    return RetreatService.instance;
  }

  // Cache management helpers
  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      if (now - timestamp > this.CACHE_EXPIRY) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  private async setCachedData<T>(key: string, data: T): Promise<void> {
    try {
      const cacheItem = { data, timestamp: Date.now() };
      await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  private async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@retreat_cache:'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // Get public events (no auth required)
  async getPublicEvents(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const response = await apiService.get<any[]>(API_ENDPOINTS.PUBLIC_EVENTS);
      if (response.success && response.data) {
        return { success: true, data: response.data.map(mapEvent) };
      }
      return { success: false, error: response.error || 'Failed to load public events' };
    } catch (error) {
      console.error('Error loading public events:', error);
      return { success: false, error: 'Failed to load public events' };
    }
  }

  // Get user's retreat groups and recent activity (backend-first with offline fallback)
  async getUserRetreats(): Promise<{ success: boolean; data?: UserRetreatData; error?: string }> {
    try {
      console.log('Fetching user groups and events...');

      // Parallel fetch: groups + access-filtered events
      const [groupsRes, eventsRes] = await Promise.all([
        apiService.get<any[]>(API_ENDPOINTS.GROUPS),
        apiService.get<any[]>(API_ENDPOINTS.EVENTS),
      ]);

      if (!groupsRes.success || !groupsRes.data) {
        throw new Error(groupsRes.error || 'Failed to load groups');
      }
      if (!eventsRes.success || !eventsRes.data) {
        throw new Error(eventsRes.error || 'Failed to load events');
      }

      const backendGroups = groupsRes.data;
      const backendEvents = eventsRes.data;
      const mappedEvents = backendEvents.map(mapEvent);

      // For each group, find events that belong to it
      const mappedGroups: RetreatGroup[] = backendGroups.map((bg: any) => {
        const groupEvents = backendEvents
          .filter((ev: any) =>
            ev.eventRetreatGroups?.some(
              (erg: any) => erg.retreatGroupId === bg.id || erg.retreatGroup?.id === bg.id
            )
          )
          .map(mapEvent);
        return mapGroup(bg, groupEvents);
      });

      // Recent gatherings: sorted by date, take last 5
      const recentGatherings = [...mappedEvents]
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .slice(0, 5);

      const totalTracks = mappedEvents.reduce((sum, ev) =>
        sum + (ev.sessions?.reduce((s, sess) => s + (sess.tracks?.length || 0), 0) || 0), 0);

      const data: UserRetreatData = {
        retreat_groups: mappedGroups,
        recent_gatherings: recentGatherings,
        total_stats: {
          total_groups: mappedGroups.length,
          total_gatherings: mappedEvents.length,
          total_tracks: totalTracks,
          completed_tracks: 0,
        },
      };

      console.log(`Loaded ${mappedGroups.length} groups, ${mappedEvents.length} events`);
      await this.setCachedData(this.CACHE_KEYS.USER_RETREATS, data);
      return { success: true, data };
    } catch (error) {
      console.error('Backend request failed:', error);

      const cachedData = await this.getCachedData<UserRetreatData>(this.CACHE_KEYS.USER_RETREATS);
      if (cachedData) {
        console.log('Using cached retreat data');
        return { success: true, data: cachedData };
      }

      return { success: false, error: 'No retreat data available. Please check your connection and try again.' };
    }
  }

  // Get detailed information about a specific retreat group
  async getRetreatGroupDetails(groupId: string): Promise<{
    success: boolean;
    data?: RetreatGroupDetails;
    error?: string
  }> {
    try {
      console.log(`Fetching group ${groupId} events...`);

      // Parallel: group events + group info
      const [eventsRes, groupsRes] = await Promise.all([
        apiService.get<any[]>(API_ENDPOINTS.GROUP_EVENTS(groupId)),
        apiService.get<any[]>(API_ENDPOINTS.GROUPS),
      ]);

      if (!eventsRes.success || !eventsRes.data) {
        return { success: false, error: eventsRes.error || 'Failed to load group events' };
      }

      const gatherings = eventsRes.data.map(mapEvent);
      const backendGroup = groupsRes.data?.find((g: any) => String(g.id) === groupId);

      const data: RetreatGroupDetails = {
        ...(backendGroup ? mapGroup(backendGroup, gatherings) : {
          id: groupId,
          name: '',
          gatherings,
          created_at: '',
          updated_at: '',
        }),
        gatherings,
        is_member: true,
      };

      return { success: true, data };
    } catch (error) {
      console.error('Get retreat group details error:', error);
      return { success: false, error: 'Failed to load retreat group details' };
    }
  }

  // Get detailed information about a specific retreat/event (backend-first with offline fallback)
  async getRetreatDetails(retreatId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string
  }> {
    const cacheKey = `${this.CACHE_KEYS.GATHERING_DETAILS}${retreatId}`;

    try {
      console.log(`Fetching event details for ID: ${retreatId}`);

      // Try authenticated endpoint first, fall back to public for unauthenticated users
      let response = await apiService.get<any>(API_ENDPOINTS.EVENT_DETAILS(retreatId));

      if (!response.success) {
        // Try public endpoint as fallback (for unauthenticated users viewing public events)
        console.log('Auth event endpoint failed, trying public endpoint...');
        response = await apiService.get<any>(API_ENDPOINTS.PUBLIC_EVENT_DETAILS(retreatId));
      }

      if (response.success && response.data) {
        const mapped = mapEvent(response.data);

        // Add retreat_group info from the event's groups
        const retreatGroup = response.data.eventRetreatGroups?.[0]?.retreatGroup;

        // Map transcripts (event-level PDFs)
        const transcripts = response.data.transcripts?.map((tr: any) => ({
          id: tr.id,
          language: tr.language,
          pageCount: tr.pageCount || tr.page_count,
          updatedAt: tr.updatedAt || tr.updated_at || '',
          originalFilename: tr.originalFilename || tr.original_filename || '',
        })) || [];

        const data = {
          ...mapped,
          transcripts,
          retreat_group: retreatGroup ? {
            id: String(retreatGroup.id),
            name: retreatGroup.nameEn || retreatGroup.name_en || '',
            name_translations: {
              en: retreatGroup.nameEn || retreatGroup.name_en || '',
              ...(retreatGroup.namePt || retreatGroup.name_pt
                ? { pt: retreatGroup.namePt || retreatGroup.name_pt }
                : {}),
            },
          } : undefined,
        };

        console.log(`Loaded event details: ${data.name}`);
        await this.setCachedData(cacheKey, data);
        return { success: true, data };
      } else {
        throw new Error(response.error || 'API request failed');
      }
    } catch (error) {
      console.error('Backend request failed:', error);

      const cachedData = await this.getCachedData<any>(cacheKey);
      if (cachedData) {
        console.log('Using cached event details');
        return { success: true, data: cachedData };
      }

      return { success: false, error: 'Retreat details not available. Please check your connection and try again.' };
    }
  }

  // Get detailed information about a specific session
  async getSessionDetails(sessionId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string
  }> {
    const cacheKey = `${this.CACHE_KEYS.GATHERING_DETAILS}session_${sessionId}`;

    try {
      console.log(`Fetching session details for ID: ${sessionId}`);

      const response = await apiService.get<any>(API_ENDPOINTS.SESSION_DETAILS(sessionId));

      if (response.success && response.data) {
        const mapped = mapSession(response.data);

        // Add gathering (parent event) info
        const event = response.data.event;
        const data = {
          ...mapped,
          gathering: event ? {
            id: String(event.id),
            name: event.titleEn || event.title_en || '',
          } : undefined,
        };

        console.log(`Loaded session details: ${data.name}`);
        await this.setCachedData(cacheKey, data);
        return { success: true, data };
      } else {
        throw new Error(response.error || 'API request failed');
      }
    } catch (error) {
      console.error('Backend request failed:', error);

      const cachedData = await this.getCachedData<any>(cacheKey);
      if (cachedData) {
        console.log('Using cached session details');
        return { success: true, data: cachedData };
      }

      return { success: false, error: 'Session details not available. Please check your connection and try again.' };
    }
  }

  // Get detailed information about a specific track
  async getTrackDetails(trackId: string): Promise<{
    success: boolean;
    data?: Track;
    error?: string
  }> {
    try {
      console.log(`Fetching track details for ID: ${trackId}`);

      const response = await apiService.get<any>(API_ENDPOINTS.TRACK_DETAILS(trackId));

      if (!response.success || !response.data) {
        return { success: false, error: response.error || 'Failed to load track details' };
      }

      return { success: true, data: mapTrack(response.data) };
    } catch (error) {
      console.error('Get track details error:', error);
      return { success: false, error: 'Failed to load track details' };
    }
  }

  // Get presigned URL for audio file access
  async getAudioPresignedUrl(trackId: string): Promise<{
    success: boolean;
    url?: string;
    error?: string
  }> {
    try {
      // Backend returns { url, expiresIn } (not presigned_url)
      const response = await apiService.get<{ url: string; presigned_url?: string }>(
        API_ENDPOINTS.PRESIGNED_URL(trackId)
      );

      if (response.success && response.data) {
        const url = response.data.url || response.data.presigned_url;
        if (url) return { success: true, url };
      }

      return { success: false, error: response.error || 'Failed to get audio URL' };
    } catch (error) {
      console.error('Get presigned URL error:', error);
      return { success: false, error: 'Failed to get audio URL' };
    }
  }

  /**
   * Fetch Read Along alignment data for a track.
   * The API proxies the JSON from S3 to avoid CORS issues on web.
   */
  async getReadAlongData(trackId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await apiService.get<any>(
        API_ENDPOINTS.READ_ALONG_URL(trackId)
      );
      if (response.success && response.data?.clean_segments) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error || 'Read Along not available' };
    } catch (error) {
      console.error('Get Read Along data error:', error);
      return { success: false, error: 'Failed to get Read Along data' };
    }
  }

  /**
   * Get a URL to view a watermarked transcript PDF.
   * - Web: returns direct API URL with token param (iframe gets proper Content-Disposition/filename)
   * - Native: fetches PDF, caches locally, returns file:// URI
   */
  async getTranscriptPdfUrl(transcriptId: string, updatedAt: string, originalFilename?: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const apiUrl = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.TRANSCRIPT_URL(transcriptId)}`;

      // Web: point iframe directly at API URL with token (gets correct filename from headers)
      if (Platform.OS === 'web') {
        if (!token) return { success: false, error: 'Authentication required' };
        return { success: true, url: `${apiUrl}?token=${encodeURIComponent(token)}` };
      }

      // Native: check cache first
      const { transcriptCacheService } = await import('./transcriptCacheService');
      const cached = await transcriptCacheService.getCached(transcriptId, updatedAt, originalFilename);
      if (cached) {
        return { success: true, url: cached };
      }

      // Fetch watermarked PDF from backend
      const response = await fetch(apiUrl, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, error: errorText || `HTTP ${response.status}` };
      }

      // Extract filename from Content-Disposition header if not provided
      let filename = originalFilename;
      if (!filename) {
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      const pdfBytes = await response.arrayBuffer();

      // Cache and return local file URI
      const localUrl = await transcriptCacheService.cache(transcriptId, updatedAt, pdfBytes, filename);
      return { success: true, url: localUrl };
    } catch (error) {
      console.error('Get transcript PDF error:', error);
      return { success: false, error: 'Failed to load transcript' };
    }
  }

  // Stream track — uses same presigned URL endpoint
  async getTrackStreamUrl(trackId: string): Promise<{
    success: boolean;
    url?: string;
    error?: string
  }> {
    return this.getAudioPresignedUrl(trackId);
  }

  // Check if track download is in progress
  isTrackDownloading(trackId: string): boolean {
    return this.activeDownloads.has(trackId);
  }

  // Cancel track download
  async cancelTrackDownload(trackId: string): Promise<boolean> {
    const download = this.activeDownloads.get(trackId);
    if (download) {
      try {
        this.cancelledDownloads.add(trackId);
        await download.pauseAsync();
        this.activeDownloads.delete(trackId);
        console.log(`Cancelled download for track: ${trackId}`);
        return true;
      } catch (error) {
        console.error(`Error cancelling download for track ${trackId}:`, error);
        this.cancelledDownloads.delete(trackId);
        return false;
      }
    }
    return false;
  }

  // Download track for offline playback
  async downloadTrack(trackId: string, onProgress?: (progress: number) => void): Promise<{
    success: boolean;
    localPath?: string;
    error?: string;
    cancelled?: boolean;
  }> {
    try {
      if (this.activeDownloads.has(trackId)) {
        return { success: false, error: 'Download already in progress' };
      }

      const streamResult = await this.getTrackStreamUrl(trackId);
      if (!streamResult.success || !streamResult.url) {
        return { success: false, error: streamResult.error || 'Failed to get stream URL' };
      }

      const tracksDir = `${FileSystem.documentDirectory}tracks/`;
      const dirInfo = await FileSystem.getInfoAsync(tracksDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tracksDir, { intermediates: true });
      }

      const localPath = `${tracksDir}${trackId}.mp3`;

      const downloadResumable = FileSystem.createDownloadResumable(
        streamResult.url,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress * 100);
        }
      );

      this.activeDownloads.set(trackId, downloadResumable);
      const downloadResult = await downloadResumable.downloadAsync();

      if (!downloadResult) {
        if (this.cancelledDownloads.has(trackId)) {
          this.cancelledDownloads.delete(trackId);
          return { success: false, cancelled: true };
        }
        return { success: false, error: 'Download failed - no result' };
      }

      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      const fileSize = fileInfo.exists ? fileInfo.size || 0 : 0;

      await this.setCachedData(`@download:${trackId}`, {
        trackId,
        localPath: downloadResult.uri,
        downloadedAt: Date.now(),
        size: fileSize,
      });

      this.activeDownloads.delete(trackId);
      this.cancelledDownloads.delete(trackId);

      return { success: true, localPath: downloadResult.uri };
    } catch (error: any) {
      this.activeDownloads.delete(trackId);

      if (this.cancelledDownloads.has(trackId)) {
        this.cancelledDownloads.delete(trackId);
        return { success: false, cancelled: true };
      }

      if (error.message && error.message.includes('cancelled')) {
        return { success: false, error: 'Download cancelled', cancelled: true };
      }

      return { success: false, error: 'Failed to download track' };
    }
  }

  // Check if track is downloaded and valid
  async isTrackDownloaded(trackId: string): Promise<boolean> {
    try {
      const downloadInfo = await this.getCachedData<{localPath: string, size: number}>(`@download:${trackId}`);
      if (!downloadInfo) return false;

      const fileInfo = await FileSystem.getInfoAsync(downloadInfo.localPath);
      if (!fileInfo.exists) {
        await AsyncStorage.removeItem(`@download:${trackId}`);
        return false;
      }

      const fileSize = fileInfo.size || 0;
      if (fileSize < 10000) {
        try {
          const fileContent = await FileSystem.readAsStringAsync(downloadInfo.localPath, { length: 200 });
          if (fileContent.includes('<?xml') && fileContent.includes('<Error>')) {
            await this.removeDownloadedTrack(trackId);
            return false;
          }
        } catch {
          // Ignore read errors during validation
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking if track is downloaded:', error);
      return false;
    }
  }

  // Get local path for downloaded track
  async getDownloadedTrackPath(trackId: string): Promise<string | null> {
    try {
      const downloadInfo = await this.getCachedData<{localPath: string}>(`@download:${trackId}`);
      return downloadInfo?.localPath || null;
    } catch {
      return null;
    }
  }

  // Remove downloaded track
  async removeDownloadedTrack(trackId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const localPath = await this.getDownloadedTrackPath(trackId);
      if (localPath) {
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(localPath);
        }
      }
      await AsyncStorage.removeItem(`@download:${trackId}`);
      return { success: true };
    } catch (error) {
      console.error('Remove download error:', error);
      return { success: false, error: 'Failed to remove download' };
    }
  }

  // Clear all cached data
  async clearAllCache(): Promise<void> {
    await this.clearCache();
  }

  // Clear all downloads and clean up files
  async clearAllDownloads(): Promise<{ success: boolean; removedCount: number; error?: string }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const downloadKeys = keys.filter(key => key.startsWith('@download:'));
      let removedCount = 0;

      for (const key of downloadKeys) {
        try {
          const trackId = key.replace('@download:', '');
          const result = await this.removeDownloadedTrack(trackId);
          if (result.success) removedCount++;
        } catch (error) {
          console.warn(`Failed to remove download for key ${key}:`, error);
        }
      }

      return { success: true, removedCount };
    } catch (error) {
      console.error('Error clearing all downloads:', error);
      return { success: false, removedCount: 0, error: 'Failed to clear downloads' };
    }
  }

  // Search events and sessions by query
  async search(query: string, lang?: string): Promise<{
    success: boolean;
    data?: SearchResponse;
    error?: string;
  }> {
    try {
      const response = await apiService.get<SearchResponse>(
        API_ENDPOINTS.SEARCH(query, lang),
      );
      if (response.success && response.data) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error || 'Search failed' };
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: 'Search failed' };
    }
  }

  // Force clear all retreat-related cache (for development)
  async forceClearAllRetreatCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const retreatKeys = keys.filter(key =>
        key.startsWith('@retreat_cache:') ||
        key.startsWith('@download:')
      );

      if (retreatKeys.length > 0) {
        await AsyncStorage.multiRemove(retreatKeys);
      }
    } catch (error) {
      console.error('Error force clearing cache:', error);
    }
  }
}

export default RetreatService.getInstance();
