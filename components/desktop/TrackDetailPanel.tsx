import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { PDFViewer } from '@/components/PDFViewer';
import { ReadAlongViewer } from '@/components/ReadAlongViewer';
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
  retreat_group?: {
    id: string;
    name: string;
    name_translations?: Record<string, string>;
  };
  transcripts?: TranscriptInfo[];
}

type DetailView = 'initial' | 'transcript' | 'readAlong';

interface TrackDetailPanelProps {
  retreat: RetreatInfo;
  currentTrack?: Track | null;
}

export function TrackDetailPanel({ retreat, currentTrack }: TrackDetailPanelProps) {
  const { t, language } = useLanguage();
  const [detailView, setDetailView] = useState<DetailView>('initial');

  // Transcript state
  const [transcriptUrl, setTranscriptUrl] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Read Along state
  const [readAlongData, setReadAlongData] = useState<any>(null);
  const [readAlongLoading, setReadAlongLoading] = useState(false);
  const [readAlongError, setReadAlongError] = useState<string | null>(null);

  // Find the best transcript for the current language
  const transcript = retreat.transcripts?.find(
    tr => tr.language === language
  ) || retreat.transcripts?.[0];

  const hasReadAlong = currentTrack?.hasReadAlong ?? false;

  // Reset read-along state when track changes
  useEffect(() => {
    setReadAlongData(null);
    setReadAlongError(null);
    if (detailView === 'readAlong') {
      setDetailView('initial');
    }
  }, [currentTrack?.id]);

  // Reset transcript state when retreat/transcript changes
  useEffect(() => {
    setTranscriptUrl(null);
    setTranscriptError(null);
    if (detailView === 'transcript') {
      setDetailView('initial');
    }
  }, [transcript?.id]);

  // Load transcript when view switches to transcript
  useEffect(() => {
    if (detailView !== 'transcript' || !transcript) return;
    if (transcriptUrl) return; // Already loaded

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
  }, [detailView, transcript?.id, transcript?.updatedAt, transcriptUrl]);

  // Load read-along data when view switches to readAlong
  useEffect(() => {
    if (detailView !== 'readAlong' || !currentTrack) return;
    if (readAlongData) return; // Already loaded

    let cancelled = false;
    setReadAlongLoading(true);
    setReadAlongError(null);

    retreatService.getReadAlongData(String(currentTrack.id)).then(result => {
      if (cancelled) return;
      if (result.success && result.data) {
        setReadAlongData(result.data);
      } else {
        setReadAlongError(result.error || 'Failed to load Read Along data');
      }
      setReadAlongLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setReadAlongError('Failed to load Read Along data');
        setReadAlongLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [detailView, currentTrack?.id, readAlongData]);

  const handleBack = useCallback(() => {
    setDetailView('initial');
  }, []);

  const languageLabel = transcript?.language === 'pt' ? 'Português' : 'English';

  // ─── Initial view: show action buttons ─────────────────────────────
  if (detailView === 'initial') {
    const hasTranscript = !!transcript;
    const showBothButtons = hasTranscript && hasReadAlong;

    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <View style={showBothButtons ? styles.buttonRow : undefined}>
            {/* View Transcript button */}
            {hasTranscript && (
              <Pressable
                style={[
                  styles.loadButton,
                  showBothButtons && styles.loadButtonHalf,
                  hoveredButton === 'transcript' && styles.loadButtonHovered,
                ]}
                onPress={() => setDetailView('transcript')}
                // @ts-ignore -- web-only
                onMouseEnter={() => setHoveredButton('transcript')}
                // @ts-ignore
                onMouseLeave={() => setHoveredButton(null)}
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
            )}

            {/* Read Along button */}
            {hasReadAlong && (
              <Pressable
                style={[
                  styles.loadButton,
                  showBothButtons && styles.loadButtonHalf,
                  hoveredButton === 'readAlong' && styles.loadButtonHovered,
                ]}
                onPress={() => setDetailView('readAlong')}
                // @ts-ignore -- web-only
                onMouseEnter={() => setHoveredButton('readAlong')}
                // @ts-ignore
                onMouseLeave={() => setHoveredButton(null)}
              >
                <Ionicons name="text-outline" size={32} color={colors.burgundy[500]} />
                <Text style={styles.loadButtonTitle}>
                  {t('readAlong.buttonLabel') || 'Read Along'}
                </Text>
                <Text style={styles.loadButtonMeta}>
                  {currentTrack?.title || ''}
                </Text>
              </Pressable>
            )}
          </View>

          {/* No content at all */}
          {!hasTranscript && !hasReadAlong && (
            <View style={styles.noContentContainer}>
              <Ionicons name="document-text-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.placeholderText}>
                {t('transcript.noTranscript') || 'No transcript available for this event'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─── Transcript view ───────────────────────────────────────────────
  if (detailView === 'transcript') {
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
            <Pressable style={styles.retryButton} onPress={handleBack}>
              <Text style={styles.retryButtonText}>{t('common.goBack') || 'Go Back'}</Text>
            </Pressable>
          </View>
        ) : transcriptUrl ? (
          <View style={styles.container}>
            <View style={styles.viewHeader}>
              <Pressable onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={colors.burgundy[500]} />
                <Text style={styles.backButtonText}>{t('common.goBack') || 'Back'}</Text>
              </Pressable>
            </View>
            <PDFViewer source={transcriptUrl} compact />
          </View>
        ) : null}
      </View>
    );
  }

  // ─── Read Along view ───────────────────────────────────────────────
  if (detailView === 'readAlong') {
    return (
      <View style={styles.container}>
        {readAlongLoading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
            <Text style={styles.placeholderText}>
              {t('readAlong.loading') || 'Loading transcript...'}
            </Text>
          </View>
        ) : readAlongError ? (
          <View style={styles.placeholder}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.gray[400]} />
            <Text style={styles.placeholderText}>{readAlongError}</Text>
            <Pressable style={styles.retryButton} onPress={handleBack}>
              <Text style={styles.retryButtonText}>{t('common.goBack') || 'Go Back'}</Text>
            </Pressable>
          </View>
        ) : readAlongData ? (
          <ReadAlongViewer readAlongData={readAlongData} onClose={handleBack} />
        ) : null}
      </View>
    );
  }

  return null;
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
  noContentContainer: {
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 20,
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
  loadButtonHalf: {
    flex: 1,
    maxWidth: 220,
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
    textAlign: 'center',
  },
  viewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    backgroundColor: 'white',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 4,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.burgundy[500],
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
