import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { PDFViewer } from '@/components/PDFViewer';
import retreatService from '@/services/retreatService';
import { Track } from '@/types';
import { colors } from '@/constants/colors';

interface TranscriptInfo {
  id: number;
  language: string;
  pageCount?: number;
  updatedAt?: string;
  originalFilename?: string;
}

interface RetreatInfo {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  year: number;
  startDate: string;
  endDate: string;
  sessions: {
    id: string;
    tracks?: Track[];
  }[];
  retreat_group: {
    id: string;
    name: string;
    name_translations?: Record<string, string>;
  };
  transcripts?: TranscriptInfo[];
}

interface TrackDetailPanelProps {
  retreat: RetreatInfo;
}

export function TrackDetailPanel({ retreat }: TrackDetailPanelProps) {
  const { t, language } = useLanguage();
  const [transcriptUrl, setTranscriptUrl] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [loadRequested, setLoadRequested] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Find the best transcript for the current language
  const transcript = retreat.transcripts?.find(
    tr => tr.language === language
  ) || retreat.transcripts?.[0];

  // Reset state when retreat/transcript changes
  useEffect(() => {
    setTranscriptUrl(null);
    setTranscriptError(null);
    setLoadRequested(false);
  }, [transcript?.id]);

  // Load watermarked transcript PDF only when user requests it
  useEffect(() => {
    if (!transcript || !loadRequested) return;

    let cancelled = false;
    setTranscriptLoading(true);
    setTranscriptError(null);

    retreatService.getTranscriptPdfUrl(
      String(transcript.id),
      transcript.updatedAt || '',
      transcript.originalFilename
    ).then(result => {
      if (cancelled) return;
      if (result.success && result.url) {
        setTranscriptUrl(result.url);
      } else {
        setTranscriptError(result.error || 'Failed to load transcript');
      }
      setTranscriptLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setTranscriptError('Failed to load transcript');
        setTranscriptLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [transcript?.id, transcript?.updatedAt, loadRequested]);

  const handleLoadTranscript = useCallback(() => {
    setLoadRequested(true);
  }, []);

  const languageLabel = transcript?.language === 'pt' ? 'Português' : 'English';

  return (
    <View style={styles.container}>
      {transcriptLoading ? (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.placeholderText}>
            {t('transcript.loadingTranscript') || 'Loading transcript...'}
          </Text>
        </View>
      ) : transcriptError ? (
        <View style={styles.placeholder}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.gray[400]} />
          <Text style={styles.placeholderText}>{transcriptError}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => { setTranscriptError(null); setLoadRequested(false); setTimeout(handleLoadTranscript, 50); }}
          >
            <Text style={styles.retryButtonText}>{t('common.retry') || 'Retry'}</Text>
          </Pressable>
        </View>
      ) : transcriptUrl ? (
        <PDFViewer source={transcriptUrl} compact />
      ) : transcript ? (
        <View style={styles.placeholder}>
          <Pressable
            style={[styles.loadButton, hovered && styles.loadButtonHovered]}
            onPress={handleLoadTranscript}
            // @ts-ignore -- web-only
            onMouseEnter={() => setHovered(true)}
            // @ts-ignore
            onMouseLeave={() => setHovered(false)}
          >
            <Ionicons name="document-text-outline" size={32} color={colors.burgundy[500]} />
            <Text style={styles.loadButtonTitle}>
              {t('transcript.viewTranscript') || 'View Transcript'}
            </Text>
            <Text style={styles.loadButtonMeta}>
              {languageLabel}
              {transcript.pageCount ? ` · ${transcript.pageCount} ${t('transcript.pages') || 'pages'}` : ''}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="document-text-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.placeholderText}>
            {t('transcript.noTranscript') || 'No transcript available for this event'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[100],
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 12,
    textAlign: 'center',
  },
  loadButton: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  loadButtonHovered: {
    borderColor: colors.burgundy[500],
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  loadButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginTop: 12,
  },
  loadButtonMeta: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 4,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.burgundy[500],
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
});
