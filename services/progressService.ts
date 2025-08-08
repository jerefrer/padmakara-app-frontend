import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProgress, Bookmark, PDFProgress } from '@/types';

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

  // Sync with backend (placeholder for future AWS integration)
  async syncWithBackend(): Promise<void> {
    try {
      // This would sync local progress with AWS/backend
      // For now, just log that sync would happen here
      console.log('Syncing progress with backend...');
      
      // const allProgress = await this.getAllProgress();
      // const allBookmarks = ... get all bookmarks
      // const allPDFProgress = await this.getAllPDFProgress();
      // Send to backend API
      // Handle conflicts, merge data, etc.
      
    } catch (error) {
      console.error('Error syncing with backend:', error);
    }
  }
}

export default ProgressService.getInstance();