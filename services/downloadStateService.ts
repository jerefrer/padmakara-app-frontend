import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DownloadState {
  requestId: string;
  retreatId: string;
  retreatName: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  startedAt: string;
  progress?: number;
  progressMessage?: string;
}

const DOWNLOAD_STORAGE_KEY = 'padmakara_active_downloads';
const MAX_DOWNLOAD_AGE_HOURS = 2; // Consider downloads stale after 2 hours

class DownloadStateService {
  /**
   * Save an active download state to persistent storage
   */
  async saveDownloadState(downloadState: DownloadState): Promise<void> {
    try {
      const existingStates = await this.getActiveDownloads();
      
      // Remove any existing download for the same retreat
      const filteredStates = existingStates.filter(
        state => state.retreatId !== downloadState.retreatId
      );
      
      // Add the new download state
      filteredStates.push(downloadState);
      
      await AsyncStorage.setItem(DOWNLOAD_STORAGE_KEY, JSON.stringify(filteredStates));
      console.log(`💾 Saved download state for retreat ${downloadState.retreatId}`);
    } catch (error) {
      console.error('Failed to save download state:', error);
    }
  }

  /**
   * Get all active downloads from storage
   */
  async getActiveDownloads(): Promise<DownloadState[]> {
    try {
      const storedStates = await AsyncStorage.getItem(DOWNLOAD_STORAGE_KEY);
      if (!storedStates) return [];
      
      const states: DownloadState[] = JSON.parse(storedStates);
      
      // Filter out stale downloads (older than MAX_DOWNLOAD_AGE_HOURS)
      const now = new Date();
      const activeStates = states.filter(state => {
        const startedAt = new Date(state.startedAt);
        const hoursDiff = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
        return hoursDiff < MAX_DOWNLOAD_AGE_HOURS;
      });
      
      // Save cleaned up states back to storage if any were filtered
      if (activeStates.length !== states.length) {
        await AsyncStorage.setItem(DOWNLOAD_STORAGE_KEY, JSON.stringify(activeStates));
      }
      
      return activeStates;
    } catch (error) {
      console.error('Failed to get active downloads:', error);
      return [];
    }
  }

  /**
   * Get active download for a specific retreat
   */
  async getDownloadForRetreat(retreatId: string): Promise<DownloadState | null> {
    try {
      const activeDownloads = await this.getActiveDownloads();
      return activeDownloads.find(state => state.retreatId === retreatId) || null;
    } catch (error) {
      console.error('Failed to get download for retreat:', error);
      return null;
    }
  }

  /**
   * Update the status and progress of an existing download
   */
  async updateDownloadState(
    retreatId: string, 
    updates: Partial<Pick<DownloadState, 'status' | 'progress' | 'progressMessage'>>
  ): Promise<void> {
    try {
      const activeDownloads = await this.getActiveDownloads();
      const downloadIndex = activeDownloads.findIndex(state => state.retreatId === retreatId);
      
      if (downloadIndex === -1) {
        console.warn(`No active download found for retreat ${retreatId}`);
        return;
      }
      
      // Update the download state
      activeDownloads[downloadIndex] = {
        ...activeDownloads[downloadIndex],
        ...updates
      };
      
      await AsyncStorage.setItem(DOWNLOAD_STORAGE_KEY, JSON.stringify(activeDownloads));
      console.log(`📝 Updated download state for retreat ${retreatId}:`, updates);
    } catch (error) {
      console.error('Failed to update download state:', error);
    }
  }

  /**
   * Remove a download from active state (when completed or cancelled)
   */
  async removeDownloadState(retreatId: string): Promise<void> {
    try {
      const activeDownloads = await this.getActiveDownloads();
      const filteredDownloads = activeDownloads.filter(state => state.retreatId !== retreatId);
      
      await AsyncStorage.setItem(DOWNLOAD_STORAGE_KEY, JSON.stringify(filteredDownloads));
      console.log(`🗑️ Removed download state for retreat ${retreatId}`);
    } catch (error) {
      console.error('Failed to remove download state:', error);
    }
  }

  /**
   * Clear all download states (for debugging or logout)
   */
  async clearAllDownloadStates(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DOWNLOAD_STORAGE_KEY);
      console.log('🧹 Cleared all download states');
    } catch (error) {
      console.error('Failed to clear download states:', error);
    }
  }

  /**
   * Check if a retreat has an active download in progress
   */
  async hasActiveDownload(retreatId: string): Promise<boolean> {
    const downloadState = await this.getDownloadForRetreat(retreatId);
    return downloadState !== null && ['pending', 'processing'].includes(downloadState.status);
  }

  /**
   * Get summary of all active downloads for debugging
   */
  async getDownloadSummary(): Promise<{retreatId: string, status: string, progress?: number}[]> {
    try {
      const activeDownloads = await this.getActiveDownloads();
      return activeDownloads.map(state => ({
        retreatId: state.retreatId,
        status: state.status,
        progress: state.progress
      }));
    } catch (error) {
      console.error('Failed to get download summary:', error);
      return [];
    }
  }

  /**
   * Force cleanup old/stale downloads (for debugging/recovery)
   */
  async forceCleanupStaleDownloads(maxAgeHours: number = 0.5): Promise<number> {
    try {
      const allStates = await AsyncStorage.getItem(DOWNLOAD_STORAGE_KEY);
      if (!allStates) return 0;
      
      const states: DownloadState[] = JSON.parse(allStates);
      const now = new Date();
      const cutoffTime = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
      
      const freshStates = states.filter(state => {
        const startedAt = new Date(state.startedAt);
        const age = now.getTime() - startedAt.getTime();
        const isStale = age > cutoffTime;
        
        if (isStale) {
          console.log(`🧹 Cleaning stale download: ${state.retreatName} (${Math.round(age / 60000)} min old)`);
        }
        
        return !isStale;
      });
      
      const cleanedCount = states.length - freshStates.length;
      
      if (cleanedCount > 0) {
        await AsyncStorage.setItem(DOWNLOAD_STORAGE_KEY, JSON.stringify(freshStates));
        console.log(`✅ Cleaned up ${cleanedCount} stale downloads`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('Failed to force cleanup stale downloads:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const downloadStateService = new DownloadStateService();
export default downloadStateService;