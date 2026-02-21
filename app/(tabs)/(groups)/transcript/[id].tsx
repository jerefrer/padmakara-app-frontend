import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PDFViewer } from '@/components/PDFViewer';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';
import retreatService from '@/services/retreatService';
import { transcriptCacheService } from '@/services/transcriptCacheService';
import * as Sharing from 'expo-sharing';

export default function TranscriptViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); // event ID
  const { t, language } = useLanguage();

  const [transcriptUrl, setTranscriptUrl] = useState<string | null>(null);
  const [transcriptId, setTranscriptId] = useState<number | null>(null);
  const [eventName, setEventName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    loadTranscript();
  }, [id, language]);

  const loadTranscript = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await retreatService.getRetreatDetails(id);
      if (!response.success || !response.data) {
        setError(t('transcript.loadError') || 'Failed to load transcript');
        setLoading(false);
        return;
      }

      const event = response.data;
      setEventName(event.name_translations?.[language] || event.name || '');

      const transcripts = event.transcripts || [];
      const transcript = transcripts.find((tr: any) => tr.language === language) || transcripts[0];

      if (!transcript) {
        setError(t('transcript.noTranscript') || 'No transcript available for this event');
        setLoading(false);
        return;
      }

      setTranscriptId(transcript.id);

      // Get watermarked PDF (cached or fetched)
      const urlResult = await retreatService.getTranscriptPdfUrl(
        String(transcript.id),
        transcript.updatedAt || '',
        transcript.originalFilename
      );
      if (urlResult.success && urlResult.url) {
        setTranscriptUrl(urlResult.url);
      } else {
        setError(urlResult.error || t('transcript.loadError') || 'Failed to load transcript');
      }
    } catch (err) {
      console.error('Load transcript error:', err);
      setError(t('transcript.loadError') || 'Failed to load transcript');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = useCallback((page: number, total: number) => {
    setPageInfo({ current: page, total });
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!transcriptId) return;
    setIsDownloading(true);

    try {
      if (Platform.OS === 'web') {
        // Web: the iframe already has browser download built in — but provide explicit download too
        if (transcriptUrl) {
          const a = document.createElement('a');
          a.href = transcriptUrl;
          a.download = 'transcript.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        // Native: use cached file path and share
        const cachedPath = await transcriptCacheService.getCachedFilePath(String(transcriptId));
        if (cachedPath && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(cachedPath, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert(
            t('transcript.downloadError') || 'Download Error',
            t('transcript.downloadErrorMessage') || 'Failed to download transcript'
          );
        }
      }
    } catch (err) {
      console.error('PDF download error:', err);
      if (Platform.OS !== 'web') {
        Alert.alert(
          t('transcript.downloadError') || 'Download Error',
          t('transcript.downloadErrorMessage') || 'Failed to download transcript'
        );
      }
    } finally {
      setIsDownloading(false);
    }
  }, [transcriptId, transcriptUrl, t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>
            {t('transcript.loadingTranscript') || 'Loading transcript...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !transcriptUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{t('transcript.transcript') || 'Transcript'}</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="document-text-outline" size={48} color={colors.gray[400]} />
          <Text style={styles.errorText}>{error || (t('transcript.transcriptNotFound') || 'Transcript not found')}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonAction}>
            <Text style={styles.backButtonText}>{t('common.goBack') || 'Go Back'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {eventName}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('transcript.transcript') || 'Transcript'}
            {pageInfo && ` — ${t('transcript.pageOf', { current: String(pageInfo.current), total: String(pageInfo.total) }) || `Page ${pageInfo.current} of ${pageInfo.total}`}`}
          </Text>
        </View>

        {/* Download/Share button */}
        <TouchableOpacity
          onPress={handleDownloadPdf}
          style={styles.headerButton}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={colors.burgundy[500]} />
          ) : (
            <Ionicons name="share-outline" size={22} color={colors.burgundy[500]} />
          )}
        </TouchableOpacity>
      </View>

      {/* PDF Viewer */}
      <PDFViewer source={transcriptUrl} onPageChange={handlePageChange} />
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerButton: {
    padding: 8,
  },
  headerText: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.gray[600],
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButtonAction: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
