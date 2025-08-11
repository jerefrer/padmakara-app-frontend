import { RetreatGroup, Gathering, Session, Track } from '@/types';
import apiService from './apiService';
import { API_ENDPOINTS, PaginatedResponse } from './apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

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

class RetreatService {
  private static instance: RetreatService;
  private readonly CACHE_KEYS = {
    USER_RETREATS: '@retreat_cache:user_retreats',
    GATHERING_DETAILS: '@retreat_cache:gathering_',
    RETREAT_GROUP_DETAILS: '@retreat_cache:group_',
  };
  private readonly CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours
  
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

      // Check if cache is expired
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
      const cacheItem = {
        data,
        timestamp: Date.now(),
      };
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


  // Get user's retreat groups and recent activity (backend-first with offline fallback)
  async getUserRetreats(): Promise<{ success: boolean; data?: UserRetreatData; error?: string }> {
    try {
      console.log('Fetching user retreats from Django backend...');
      
      const response = await apiService.get<UserRetreatData>(API_ENDPOINTS.USER_RETREATS);

      if (response.success && response.data) {
        console.log(`✅ Loaded ${response.data.retreat_groups.length} retreat groups from backend`);
        // Cache the fresh backend data
        await this.setCachedData(this.CACHE_KEYS.USER_RETREATS, response.data);
        return { success: true, data: response.data };
      } else {
        console.log('❌ Backend API failed, checking cached data only');
        throw new Error(response.error || 'API request failed');
      }
    } catch (error) {
      console.error('Backend request failed:', error);
      
      // Try to get cached data as fallback
      const cachedData = await this.getCachedData<UserRetreatData>(this.CACHE_KEYS.USER_RETREATS);
      if (cachedData) {
        console.log('📦 Using cached retreat data from backend');
        return { success: true, data: cachedData };
      }
      
      // No backend data available - return error
      console.log('❌ No backend data available, returning error');
      return { success: false, error: 'No retreat data available. Please check your connection and try again.' };
    }
  }

  // Get all retreat groups (for admin or browse view)
  async getRetreatGroups(page: number = 1, limit: number = 20): Promise<{ 
    success: boolean; 
    data?: PaginatedResponse<RetreatGroup>; 
    error?: string 
  }> {
    try {
      const response = await apiService.get<PaginatedResponse<RetreatGroup>>(
        `${API_ENDPOINTS.RETREAT_GROUPS}?page=${page}&limit=${limit}`
      );

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Failed to load retreat groups' 
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get retreat groups error:', error);
      return { success: false, error: 'Failed to load retreat groups' };
    }
  }

  // Get detailed information about a specific retreat group
  async getRetreatGroupDetails(groupId: string): Promise<{ 
    success: boolean; 
    data?: RetreatGroupDetails; 
    error?: string 
  }> {
    try {
      console.log(`Fetching retreat group details for ID: ${groupId}`);
      
      const response = await apiService.get<RetreatGroupDetails>(
        API_ENDPOINTS.RETREAT_DETAILS(groupId)
      );

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Failed to load retreat group details' 
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get retreat group details error:', error);
      return { success: false, error: 'Failed to load retreat group details' };
    }
  }

  // Get detailed information about a specific retreat (backend-first with offline fallback)
  async getRetreatDetails(retreatId: string): Promise<{ 
    success: boolean; 
    data?: any; 
    error?: string 
  }> {
    const cacheKey = `${this.CACHE_KEYS.GATHERING_DETAILS}${retreatId}`;
    
    try {
      console.log(`Fetching retreat details for ID: ${retreatId}`);
      
      const response = await apiService.get<any>(
        `/retreats/retreats/${retreatId}/`
      );

      if (response.success && response.data) {
        console.log(`✅ Loaded retreat details from backend: ${response.data.name}`);
        await this.setCachedData(cacheKey, response.data);
        return { success: true, data: response.data };
      } else {
        console.log('❌ Backend API failed for retreat details, checking cache only');
        throw new Error(response.error || 'API request failed');
      }
    } catch (error) {
      console.error('Backend request failed:', error);
      
      // Try cached data from previous backend responses
      const cachedData = await this.getCachedData<any>(cacheKey);
      if (cachedData) {
        console.log('📦 Using cached retreat details from backend');
        return { success: true, data: cachedData };
      }
      
      // No backend data available - return error
      console.log('❌ No backend retreat data available');
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
      
      const response = await apiService.get<any>(
        `/retreats/sessions/${sessionId}/`
      );

      if (response.success && response.data) {
        console.log(`✅ Loaded session details from backend: ${response.data.name}`);
        await this.setCachedData(cacheKey, response.data);
        return { success: true, data: response.data };
      } else {
        console.log('❌ Backend API failed for session details, checking cache only');
        throw new Error(response.error || 'API request failed');
      }
    } catch (error) {
      console.error('Backend request failed:', error);
      
      // Try cached data from previous backend responses
      const cachedData = await this.getCachedData<any>(cacheKey);
      if (cachedData) {
        console.log('📦 Using cached session details from backend');
        return { success: true, data: cachedData };
      }
      
      // No backend data available - return error
      console.log('❌ No backend session data available');
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
      
      const response = await apiService.get<Track>(
        API_ENDPOINTS.TRACK_DETAILS(trackId)
      );

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Failed to load track details' 
        };
      }

      return { success: true, data: response.data };
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
      console.log(`Getting presigned URL for track: ${trackId}`);
      
      const response = await apiService.get<{ presigned_url: string }>(
        API_ENDPOINTS.PRESIGNED_URL(trackId)
      );

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Failed to get audio URL' 
        };
      }

      return { success: true, url: response.data.presigned_url };
    } catch (error) {
      console.error('Get presigned URL error:', error);
      return { success: false, error: 'Failed to get audio URL' };
    }
  }

  // Get presigned URL for transcript file access
  async getTranscriptPresignedUrl(trackId: string): Promise<{ 
    success: boolean; 
    url?: string; 
    error?: string 
  }> {
    try {
      console.log(`Getting transcript URL for track: ${trackId}`);
      
      const response = await apiService.get<{ presigned_url: string }>(
        API_ENDPOINTS.TRANSCRIPT_URL(trackId)
      );

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Failed to get transcript URL' 
        };
      }

      return { success: true, url: response.data.presigned_url };
    } catch (error) {
      console.error('Get transcript URL error:', error);
      return { success: false, error: 'Failed to get transcript URL' };
    }
  }

  // Search retreats/gatherings/tracks
  async searchContent(query: string, type?: 'retreat' | 'gathering' | 'track'): Promise<{ 
    success: boolean; 
    results?: any[]; 
    error?: string 
  }> {
    try {
      const params = new URLSearchParams({ 
        q: query,
        ...(type && { type }) 
      });
      
      const response = await apiService.get<{ results: any[] }>(
        `/retreats/search/?${params.toString()}`
      );

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Search failed' 
        };
      }

      return { success: true, results: response.data.results };
    } catch (error) {
      console.error('Search content error:', error);
      return { success: false, error: 'Search failed' };
    }
  }

  // Stream track directly from backend or cached URL
  async getTrackStreamUrl(trackId: string): Promise<{ 
    success: boolean; 
    url?: string; 
    error?: string 
  }> {
    try {
      console.log(`Getting stream URL for track: ${trackId}`);
      
      // Try to get presigned URL from backend
      const response = await apiService.get<{ presigned_url: string }>(
        `/retreats/presigned-url/${trackId}/`
      );

      if (response.success && response.data?.presigned_url) {
        console.log(`✅ Got stream URL from backend for track: ${trackId}`);
        return { success: true, url: response.data.presigned_url };
      } else {
        console.log('❌ Backend failed to provide stream URL');
        return { success: false, error: 'Stream URL not available. Please check your connection.' };
      }
    } catch (error) {
      console.error('Get stream URL error:', error);
      return { success: false, error: 'Failed to get stream URL. Please check your connection.' };
    }
  }

  // Download track for offline playback
  async downloadTrack(trackId: string, onProgress?: (progress: number) => void): Promise<{
    success: boolean;
    localPath?: string;
    error?: string;
  }> {
    try {
      console.log(`Starting download for track: ${trackId}`);

      // First get the stream URL
      const streamResult = await this.getTrackStreamUrl(trackId);
      if (!streamResult.success || !streamResult.url) {
        return { success: false, error: streamResult.error || 'Failed to get stream URL' };
      }

      // Create tracks directory if it doesn't exist
      const tracksDir = `${FileSystem.documentDirectory}tracks/`;
      const dirInfo = await FileSystem.getInfoAsync(tracksDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tracksDir, { intermediates: true });
      }

      const localPath = `${tracksDir}${trackId}.mp3`;
      
      console.log(`📥 Downloading from: ${streamResult.url}`);
      console.log(`📁 Saving to: ${localPath}`);
      
      // Create download resumable for progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        streamResult.url,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress * 100);
        }
      );

      const downloadResult = await downloadResumable.downloadAsync();
      
      if (!downloadResult) {
        return { success: false, error: 'Download failed - no result' };
      }
      
      // Get file size for metadata
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      const fileSize = fileInfo.exists ? fileInfo.size || 0 : 0;
      
      // Store download info in AsyncStorage
      await this.setCachedData(`@download:${trackId}`, {
        trackId,
        localPath: downloadResult.uri,
        downloadedAt: Date.now(),
        size: fileSize,
      });

      console.log(`✅ Track download completed: ${trackId} (${Math.round(fileSize / 1024 / 1024)}MB)`);
      return { success: true, localPath: downloadResult.uri };
      
    } catch (error) {
      console.error('Download track error:', error);
      return { success: false, error: 'Failed to download track' };
    }
  }

  // Check if track is downloaded and valid
  async isTrackDownloaded(trackId: string): Promise<boolean> {
    try {
      const downloadInfo = await this.getCachedData<{localPath: string, size: number}>(`@download:${trackId}`);
      if (!downloadInfo) {
        return false;
      }
      
      // Check if the file actually exists and is not just an error response
      const fileInfo = await FileSystem.getInfoAsync(downloadInfo.localPath);
      if (!fileInfo.exists) {
        console.log(`❌ Downloaded file doesn't exist: ${downloadInfo.localPath}`);
        // Clean up invalid cache entry
        await AsyncStorage.removeItem(`@download:${trackId}`);
        return false;
      }
      
      // Check if file is suspiciously small (likely an error response)
      const fileSize = fileInfo.size || 0;
      if (fileSize < 10000) { // Less than 10KB is suspicious for audio
        console.log(`⚠️ Downloaded file is suspiciously small (${fileSize} bytes), checking content...`);
        
        try {
          // Read first few bytes to check if it's XML error response
          const fileContent = await FileSystem.readAsStringAsync(downloadInfo.localPath, { length: 200 });
          if (fileContent.includes('<?xml') && fileContent.includes('<Error>')) {
            console.log(`❌ Downloaded file is actually an XML error response, removing...`);
            await this.removeDownloadedTrack(trackId);
            return false;
          }
        } catch (readError) {
          console.warn('Could not read file content for validation:', readError);
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
      console.log(`Removing downloaded track: ${trackId}`);
      
      // Get the local path before removing from cache
      const localPath = await this.getDownloadedTrackPath(trackId);
      
      // Delete actual file
      if (localPath) {
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(localPath);
          console.log(`🗑️ Deleted file: ${localPath}`);
        }
      }

      // Remove from cache
      await AsyncStorage.removeItem(`@download:${trackId}`);
      
      console.log(`✅ Removed downloaded track: ${trackId}`);
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
      console.log('🧹 Clearing all downloads...');
      const keys = await AsyncStorage.getAllKeys();
      const downloadKeys = keys.filter(key => key.startsWith('@download:'));
      let removedCount = 0;
      
      for (const key of downloadKeys) {
        try {
          const trackId = key.replace('@download:', '');
          const result = await this.removeDownloadedTrack(trackId);
          if (result.success) {
            removedCount++;
          }
        } catch (error) {
          console.warn(`Failed to remove download for key ${key}:`, error);
        }
      }
      
      console.log(`✅ Cleared ${removedCount} downloads`);
      return { success: true, removedCount };
    } catch (error) {
      console.error('Error clearing all downloads:', error);
      return { success: false, removedCount: 0, error: 'Failed to clear downloads' };
    }
  }

  // Force clear all retreat-related cache (for development)
  async forceClearAllRetreatCache(): Promise<void> {
    try {
      console.log('🧹 Force clearing all retreat cache data...');
      const keys = await AsyncStorage.getAllKeys();
      const retreatKeys = keys.filter(key => 
        key.startsWith('@retreat_cache:') || 
        key.startsWith('@download:')
      );
      
      if (retreatKeys.length > 0) {
        await AsyncStorage.multiRemove(retreatKeys);
        console.log(`✅ Cleared ${retreatKeys.length} cached retreat items`);
      } else {
        console.log('ℹ️ No cached retreat data found to clear');
      }
    } catch (error) {
      console.error('Error force clearing cache:', error);
    }
  }
}

export default RetreatService.getInstance();