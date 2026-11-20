import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PDFViewer, type PDFViewerHandle } from '@/components/PDFViewer';
import { ReaderTopBar } from '@/components/ReaderTopBar';
import { PdfOutlineSheet } from '@/components/PdfOutlineSheet';
import { PageBookmarkButton } from '@/components/PageBookmarkButton';
import { ReadingThemeButton } from '@/components/ReadingThemeButton';
import { useReadingTheme } from '@/hooks/useReadingTheme';
import { useReaderDocument } from '@/hooks/useReaderDocument';
import type { PdfOutlineItem } from '@/utils/pdfOutline';
import { useReaderBars } from '@/hooks/useReaderBars';
import { useUnlockedOrientation } from '@/hooks/useUnlockedOrientation';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';
import retreatService, { transcriptErrorKey } from '@/services/retreatService';
import { transcriptCacheService } from '@/services/transcriptCacheService';
import * as Sharing from 'expo-sharing';
import { downloadFileWeb } from '@/utils/downloadFileWeb';
import { BackButton } from '@/components/ui/BackButton';
import { WatermarkNotice } from '@/components/WatermarkNotice';
import { useAuth } from '@/contexts/AuthContext';
import { willWatermarkTranscript } from '@/utils/watermark';
import { pickTranscript } from '@/utils/transcriptMeta';

export default function TranscriptViewerScreen() {
  // `id`: the event. `transcript`: open that transcript (a page bookmark) rather
  // than the one picked for the UI language; `page`: open on that page.
  const { id, transcript: transcriptParam, page: pageParam } = useLocalSearchParams<{
    id: string;
    transcript?: string;
    page?: string;
  }>();
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();

  const [transcriptUrl, setTranscriptUrl] = useState<string | null>(null);
  const [transcriptId, setTranscriptId] = useState<number | null>(null);
  const [transcriptPageCount, setTranscriptPageCount] = useState<number | null>(null);
  const [eventName, setEventName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  // True while a personal, watermarked copy is being fetched.
  const [showWatermarkNotice, setShowWatermarkNotice] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number } | null>(null);
  const [outline, setOutline] = useState<PdfOutlineItem[]>([]);
  const [outlineVisible, setOutlineVisible] = useState(false);
  const [readerBarHeight, setReaderBarHeight] = useState(0);
  const viewerRef = useRef<PDFViewerHandle>(null);
  const [readingTheme, setReadingTheme] = useReadingTheme();
  // Where the transcript opens and its page bookmarks, for this person.
  const reader = useReaderDocument(
    transcriptId !== null ? { type: 'transcript', id: String(transcriptId) } : null,
    { pageCount: transcriptPageCount },
  );
  const requestedPage = Number(pageParam);
  const openOnPage = Number.isSafeInteger(requestedPage) && requestedPage >= 1 ? requestedPage : reader.initialPage;
  const currentPage = pageInfo?.current ?? openOnPage ?? 1;
  // Reader mode: a tap on the page hides the header, tab bar and mini player;
  // the phone may turn sideways while the transcript is open.
  const { barsHidden, toggleBars } = useReaderBars(!!transcriptUrl, { fullWindow: true });
  useUnlockedOrientation(true);

  useEffect(() => {
    loadTranscript();
  }, [id, language, transcriptParam]);

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

      const transcripts: {
        id: number;
        language?: string;
        status?: string;
        updatedAt?: string;
        originalFilename?: string;
        pageCount?: number | null;
      }[] = event.transcripts || [];
      // The one a link asked for, else in the UI language, the final text
      // before a provisional or draft one
      const transcript =
        transcripts.find((tr) => transcriptParam !== undefined && String(tr.id) === String(transcriptParam)) ??
        pickTranscript(transcripts, language);

      if (!transcript) {
        setError(t('transcript.noTranscript') || 'No transcript available for this event');
        setLoading(false);
        return;
      }

      setTranscriptId(transcript.id);
      setTranscriptPageCount(transcript.pageCount ?? null);
      setShowWatermarkNotice(
        willWatermarkTranscript({ isAuthenticated, audienceSlug: event.audienceSlug })
      );

      // Get watermarked PDF (cached or fetched)
      const urlResult = await retreatService.getTranscriptPdfUrl(
        String(transcript.id),
        transcript.updatedAt || '',
        transcript.originalFilename
      );
      if (urlResult.success && urlResult.url) {
        setTranscriptUrl(urlResult.url);
      } else {
        const key = transcriptErrorKey(urlResult.errorCode ?? 'generic');
        setError(t(key) || t('transcript.loadError') || 'Failed to load transcript');
      }
    } catch (err) {
      console.error('Load transcript error:', err);
      setError(t('transcript.loadError') || 'Failed to load transcript');
    } finally {
      setLoading(false);
      setShowWatermarkNotice(false);
    }
  };

  const { reportPage } = reader;
  const handlePageChange = useCallback(
    (page: number, total: number) => {
      setPageInfo({ current: page, total });
      reportPage(page);
    },
    [reportPage],
  );
  const pageBookmarked = reader.bookmarks.includes(currentPage);

  const handleDownloadPdf = useCallback(async () => {
    if (!transcriptId) return;
    setIsDownloading(true);

    try {
      if (Platform.OS === 'web') {
        if (transcriptUrl) {
          await downloadFileWeb(transcriptUrl, eventName ? `${eventName} — Transcript.pdf` : 'transcript.pdf');
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
  }, [transcriptId, transcriptUrl, eventName, t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>
            {t('transcript.loadingTranscript') || 'Loading transcript...'}
          </Text>
          {showWatermarkNotice && <WatermarkNotice />}
        </View>
      </SafeAreaView>
    );
  }

  if (error || !transcriptUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton variant="inline" />
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
    <SafeAreaView
      style={styles.container}
      testID="transcript-view"
      // The page always fills the screen; the header is laid over it.
      edges={['left', 'right']}
    >
      <StatusBar hidden={barsHidden} animated />
      <View style={styles.reader}>
        <ReaderTopBar hidden={barsHidden} style={styles.topBar} onHeightChange={setReaderBarHeight}>
          <View style={styles.header}>
            <BackButton variant="inline" />

            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {eventName}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t('transcript.transcript') || 'Transcript'}
                {pageInfo && ` — ${t('transcript.pageOf', { current: String(pageInfo.current), total: String(pageInfo.total) }) || `Page ${pageInfo.current} of ${pageInfo.total}`}`}
              </Text>
            </View>

            <ReadingThemeButton
              testID="transcript-reading-theme-button"
              theme={readingTheme}
              onChange={setReadingTheme}
              style={styles.headerButton}
            />

            {reader.ready && (
              <PageBookmarkButton
                testID="transcript-page-bookmark-button"
                bookmarked={pageBookmarked}
                onToggle={() => reader.setBookmark(currentPage, !pageBookmarked)}
                style={styles.headerButton}
              />
            )}

            {(outline.length > 0 || reader.bookmarks.length > 0) && (
              <TouchableOpacity
                testID="transcript-contents-button"
                onPress={() => setOutlineVisible(true)}
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel={
                  outline.length > 0
                    ? t('pdfViewer.openContents') || 'Table of contents'
                    : t('pdfViewer.bookmarkedPages') || 'Bookmarked pages'
                }
              >
                <Ionicons name="list-outline" size={24} color={colors.burgundy[500]} />
              </TouchableOpacity>
            )}

            {/* The one download button: the file on the web, the share sheet on phones.
                The viewer's own toolbar button is turned off below. */}
            <TouchableOpacity
              testID="transcript-download-button"
              onPress={handleDownloadPdf}
              style={styles.headerButton}
              disabled={isDownloading}
              accessibilityRole="button"
              accessibilityLabel={
                Platform.OS === 'web'
                  ? t('transcript.downloadPdf') || 'Download PDF'
                  : t('documents.share') || 'Share or save this text'
              }
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={colors.burgundy[500]} />
              ) : (
                <Ionicons name="share-outline" size={22} color={colors.burgundy[500]} />
              )}
            </TouchableOpacity>
          </View>
        </ReaderTopBar>
        {/* PDF Viewer: mounted once the page to open on is known. */}
        {reader.ready ? (
          <PDFViewer
            ref={viewerRef}
            source={transcriptUrl}
            title={eventName ? `${eventName} — Transcript` : undefined}
            initialPage={openOnPage}
            onPageChange={handlePageChange}
            onSingleTap={toggleBars}
            fullWindow
            barsHidden={barsHidden}
            onOutline={setOutline}
            contentInsetTop={readerBarHeight}
            readingTheme={readingTheme}
            showDownloadButton={false}
          />
        ) : (
          <View style={[styles.loadingContainer, { paddingTop: readerBarHeight }]}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
          </View>
        )}
      </View>

      <PdfOutlineSheet
        visible={outlineVisible}
        items={outline}
        currentPage={currentPage}
        onSelect={(page) => viewerRef.current?.goToPage(page)}
        onClose={() => setOutlineVisible(false)}
        bookmarks={reader.bookmarks}
        onRemoveBookmark={(page) => reader.setBookmark(page, false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  reader: {
    flex: 1,
  },
  topBar: {
    backgroundColor: colors.white,
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
