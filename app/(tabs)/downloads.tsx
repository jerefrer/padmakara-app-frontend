import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { mockRetreatGroups } from '@/data/mockData';
import { Track, DownloadedContent } from '@/types';
import i18n from '@/utils/i18n';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    100: '#fde6e6',
    500: '#b91c1c',
    600: '#991b1b',
    700: '#7f1d1d',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface DownloadProgress {
  trackId: string;
  progress: number; // 0-1
  isDownloading: boolean;
}

export default function DownloadsScreen() {
  const [downloads, setDownloads] = useState<DownloadedContent[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress[]>([]);
  const [totalStorageUsed, setTotalStorageUsed] = useState(0);

  useEffect(() => {
    loadDownloads();
    calculateStorageUsed();
  }, []);

  const loadDownloads = async () => {
    try {
      // In a real app, this would load from a proper database
      // For now, we'll simulate some downloaded content
      const mockDownloads: DownloadedContent[] = [
        {
          id: 'download-1',
          type: 'audio',
          trackId: 'track-1',
          localPath: `${FileSystem.documentDirectory}track-1.mp3`,
          downloadedAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          size: 25 * 1024 * 1024, // 25MB
        },
      ];
      setDownloads(mockDownloads);
    } catch (error) {
      console.error('Error loading downloads:', error);
    }
  };

  const calculateStorageUsed = async () => {
    try {
      // Calculate total storage used by downloads
      let total = 0;
      for (const download of downloads) {
        total += download.size;
      }
      setTotalStorageUsed(total);
    } catch (error) {
      console.error('Error calculating storage:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const findTrackById = (trackId: string): Track | null => {
    for (const group of mockRetreatGroups) {
      for (const gathering of group.gatherings) {
        for (const session of gathering.sessions) {
          const track = session.tracks.find(t => t.id === trackId);
          if (track) return track;
        }
      }
    }
    return null;
  };

  const downloadTrack = async (track: Track) => {
    try {
      // Check if already downloading
      if (downloadProgress.find(p => p.trackId === track.id)) {
        return;
      }

      // Add to download progress
      setDownloadProgress(prev => [...prev, {
        trackId: track.id,
        progress: 0,
        isDownloading: true,
      }]);

      // In a real app, this would download from S3
      // For now, we'll simulate a download with progress
      const localPath = `${FileSystem.documentDirectory}${track.id}.mp3`;
      
      // Simulate download progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate download time
        
        setDownloadProgress(prev => 
          prev.map(p => 
            p.trackId === track.id 
              ? { ...p, progress: progress / 100 }
              : p
          )
        );
      }

      // Simulate file creation (in real app, file would be downloaded)
      const simulatedSize = Math.floor(Math.random() * 50) * 1024 * 1024; // Random size 0-50MB
      
      const newDownload: DownloadedContent = {
        id: `download-${Date.now()}`,
        type: 'audio',
        trackId: track.id,
        localPath,
        downloadedAt: new Date().toISOString(),
        size: simulatedSize,
      };

      // Add to downloads
      setDownloads(prev => [...prev, newDownload]);
      
      // Remove from progress
      setDownloadProgress(prev => prev.filter(p => p.trackId !== track.id));
      
      // Update storage
      setTotalStorageUsed(prev => prev + simulatedSize);
      
      Alert.alert('Download Complete', `${track.title} has been downloaded for offline listening.`);
      
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'There was an error downloading this track.');
      
      // Remove from progress on error
      setDownloadProgress(prev => prev.filter(p => p.trackId !== track.id));
    }
  };

  const deleteDownload = async (download: DownloadedContent) => {
    Alert.alert(
      'Delete Download',
      'Are you sure you want to delete this downloaded file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // In real app, delete the actual file
              // await FileSystem.deleteAsync(download.localPath);
              
              // Remove from downloads list
              setDownloads(prev => prev.filter(d => d.id !== download.id));
              
              // Update storage
              setTotalStorageUsed(prev => prev - download.size);
              
            } catch (error) {
              console.error('Error deleting download:', error);
              Alert.alert('Error', 'Could not delete the downloaded file.');
            }
          },
        },
      ]
    );
  };

  // Get all tracks for download suggestions
  const allTracks = mockRetreatGroups
    .flatMap(group => group.gatherings)
    .flatMap(gathering => gathering.sessions)
    .flatMap(session => session.tracks);

  // Filter out already downloaded tracks
  const downloadedTrackIds = new Set(downloads.map(d => d.trackId));
  const availableForDownload = allTracks.filter(track => !downloadedTrackIds.has(track.id));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {i18n.t('downloads.myDownloads')}
          </Text>
          <Text style={styles.subtitle}>
            Manage your offline content
          </Text>
        </View>

        {/* Storage Info */}
        <View style={styles.card}>
          <View style={styles.storageHeader}>
            <Text style={styles.cardTitle}>
              {i18n.t('downloads.storage')}
            </Text>
            <Text style={styles.storageAmount}>
              {formatBytes(totalStorageUsed)}
            </Text>
          </View>
          <View style={styles.storageBar}>
            <View style={[styles.storageUsed, { width: '25%' }]} />
          </View>
          <Text style={styles.storageInfo}>
            {downloads.length} files downloaded
          </Text>
        </View>

        {/* Downloaded Files */}
        {downloads.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Downloaded Content</Text>
            {downloads.map((download) => {
              const track = findTrackById(download.trackId);
              if (!track) return null;

              return (
                <View key={download.id} style={styles.downloadItem}>
                  <View style={styles.downloadInfo}>
                    <Text style={styles.downloadTitle} numberOfLines={2}>
                      {track.title}
                    </Text>
                    <View style={styles.downloadMeta}>
                      <Text style={styles.downloadSize}>
                        {formatBytes(download.size)}
                      </Text>
                      <Text style={styles.downloadDate}>
                        {new Date(download.downloadedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteDownload(download)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.gray[500]} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Currently Downloading */}
        {downloadProgress.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Downloading</Text>
            {downloadProgress.map((progress) => {
              const track = findTrackById(progress.trackId);
              if (!track) return null;

              return (
                <View key={progress.trackId} style={styles.downloadItem}>
                  <View style={styles.downloadInfo}>
                    <Text style={styles.downloadTitle} numberOfLines={2}>
                      {track.title}
                    </Text>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${progress.progress * 100}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {Math.round(progress.progress * 100)}%
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Available for Download */}
        {availableForDownload.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available for Download</Text>
            {availableForDownload.slice(0, 10).map((track) => {
              const isDownloading = downloadProgress.find(p => p.trackId === track.id);

              return (
                <View key={track.id} style={styles.downloadItem}>
                  <View style={styles.downloadInfo}>
                    <Text style={styles.downloadTitle} numberOfLines={2}>
                      {track.title}
                    </Text>
                    <Text style={styles.downloadEstimate}>
                      ~{Math.floor(track.duration / 60)}min • ~{Math.floor(Math.random() * 30 + 10)}MB
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => downloadTrack(track)}
                    style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                    disabled={!!isDownloading}
                  >
                    <Ionicons 
                      name={isDownloading ? "hourglass-outline" : "download-outline"} 
                      size={20} 
                      color="white" 
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {downloads.length === 0 && downloadProgress.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="download-outline" size={64} color={colors.gray[400]} />
            <Text style={styles.emptyTitle}>No Downloads Yet</Text>
            <Text style={styles.emptyText}>
              Download tracks to listen offline during your retreat practice.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingVertical: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.burgundy[500],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray[600],
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  storageAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  storageBar: {
    height: 8,
    backgroundColor: colors.gray[300],
    borderRadius: 4,
    marginBottom: 8,
  },
  storageUsed: {
    height: '100%',
    backgroundColor: colors.burgundy[500],
    borderRadius: 4,
  },
  storageInfo: {
    fontSize: 14,
    color: colors.gray[600],
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 16,
  },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  downloadInfo: {
    flex: 1,
    marginRight: 12,
  },
  downloadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 4,
  },
  downloadMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  downloadSize: {
    fontSize: 14,
    color: colors.gray[600],
  },
  downloadDate: {
    fontSize: 14,
    color: colors.gray[500],
  },
  downloadEstimate: {
    fontSize: 14,
    color: colors.gray[500],
  },
  deleteButton: {
    padding: 8,
  },
  downloadButton: {
    backgroundColor: colors.burgundy[500],
    borderRadius: 20,
    padding: 8,
  },
  downloadButtonDisabled: {
    backgroundColor: colors.gray[400],
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.gray[300],
    borderRadius: 2,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.burgundy[500],
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: colors.gray[600],
    minWidth: 30,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.gray[600],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 24,
  },
});