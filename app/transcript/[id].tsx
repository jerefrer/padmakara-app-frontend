import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PDFViewer } from '@/components/PDFViewer';
import { mockRetreatGroups } from '@/data/mockData';
import { Track, PDFProgress } from '@/types';
import progressService from '@/services/progressService';
import { useLanguage } from '@/contexts/LanguageContext';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
  },
  gray: {
    200: '#e5e7eb',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

export default function TranscriptViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [track, setTrack] = useState<Track | null>(null);
  const [pdfProgress, setPdfProgress] = useState<PDFProgress | null>(null);

  useEffect(() => {
    findTrack();
    loadPDFProgress();
  }, [id]);

  const findTrack = () => {
    // Find the track by ID
    for (const group of mockRetreatGroups) {
      for (const gathering of group.gatherings) {
        for (const session of gathering.sessions) {
          const foundTrack = session.tracks.find(t => t.id === id);
          if (foundTrack) {
            setTrack(foundTrack);
            return;
          }
        }
      }
    }
  };

  const loadPDFProgress = async () => {
    try {
      // In production, this would load PDF progress from storage
      // For now, simulate some progress
      const mockProgress: PDFProgress = {
        transcriptId: id || '',
        page: 1,
        highlights: [],
        lastRead: new Date().toISOString(),
      };
      setPdfProgress(mockProgress);
    } catch (error) {
      console.error('Error loading PDF progress:', error);
    }
  };

  const handleProgressUpdate = async (progress: PDFProgress) => {
    try {
      setPdfProgress(progress);
      // In production, save to your backend/database
      console.log('PDF progress updated:', progress);
    } catch (error) {
      console.error('Error saving PDF progress:', error);
    }
  };

  const openAudioPlayer = () => {
    // Navigate back and potentially open audio player
    // You could pass parameters to automatically play this track
    router.back();
  };

  if (!track) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Transcript not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get transcript URL - in production this would be from S3
  const transcriptUrl = track.transcriptUrl || '/samples/2023-10-26_27-MIND TRAINING 2.pdf';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
        </TouchableOpacity>
        
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {track.title}
          </Text>
          <Text style={styles.headerSubtitle}>{t('retreats.transcript')}</Text>
        </View>

        <TouchableOpacity onPress={openAudioPlayer} style={styles.headerButton}>
          <Ionicons name="play-circle" size={24} color={colors.burgundy[500]} />
        </TouchableOpacity>
      </View>

      {/* PDF Viewer */}
      <PDFViewer
        source={transcriptUrl}
        transcriptId={track.id}
        onProgressUpdate={handleProgressUpdate}
      />

      {/* Reading Progress Info */}
      {pdfProgress && (
        <View style={styles.progressInfo}>
          <View style={styles.progressItem}>
            <Ionicons name="bookmark-outline" size={16} color={colors.gray[500]} />
            <Text style={styles.progressText}>
              Page {pdfProgress.page}
            </Text>
          </View>
          
          <View style={styles.progressItem}>
            <Ionicons name="brush-outline" size={16} color={colors.gray[500]} />
            <Text style={styles.progressText}>
              {pdfProgress.highlights.length} highlights
            </Text>
          </View>
          
          <View style={styles.progressItem}>
            <Ionicons name="time-outline" size={16} color={colors.gray[500]} />
            <Text style={styles.progressText}>
              {new Date(pdfProgress.lastRead).toLocaleDateString()}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerButton: {
    padding: 8,
  },
  headerText: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
    marginTop: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: colors.gray[600],
    marginLeft: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.gray[600],
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});