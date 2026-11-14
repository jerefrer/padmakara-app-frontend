import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { flattenPdfOutline } from '@/utils/pdfOutline';
import type { PDFViewerHandle, PDFViewerProps } from './PDFViewer.types';

export type { PDFViewerHandle, PDFViewerProps } from './PDFViewer.types';

// A single tap waits this long before it counts: an internal link moves to
// another page within it, and that tap must not also toggle the reader's bars.
const TAP_DELAY_MS = 300;
const PAGE_BADGE_MS = 1500;

/**
 * iOS and Android: native PDF rendering through react-native-pdf (PDFKit on
 * iOS, PdfiumAndroid on Android). Internal links (a table of contents inside
 * the document) jump to their page natively. Web uses PDFViewer.web.tsx.
 * Requires a dev client or production build — not available in Expo Go.
 * Accepts file:// paths and https URLs.
 */
export const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(function PDFViewer(
  { source, onPageChange, onSingleTap, onOutline },
  ref
) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageBadge, setPageBadge] = useState<string | null>(null);
  const pdfRef = useRef<PdfRef>(null);
  const currentPage = useRef(1);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const badgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    goToPage: (page: number) => pdfRef.current?.setPage(page),
  }));

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (badgeTimer.current) clearTimeout(badgeTimer.current);
    },
    []
  );

  const handlePageChanged = useCallback(
    (page: number, totalPages: number) => {
      currentPage.current = page;
      onPageChange?.(page, totalPages);
      setPageBadge(`${page} / ${totalPages}`);
      if (badgeTimer.current) clearTimeout(badgeTimer.current);
      badgeTimer.current = setTimeout(() => setPageBadge(null), PAGE_BADGE_MS);
    },
    [onPageChange]
  );

  const handleSingleTap = useCallback(() => {
    if (!onSingleTap) return;
    const pageAtTap = currentPage.current;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      if (currentPage.current === pageAtTap) onSingleTap();
    }, TAP_DELAY_MS);
  }, [onSingleTap]);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>{t('pdfViewer.loading') || 'Loading PDF...'}</Text>
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.gray[400]} />
          <Text style={styles.errorText}>{t('pdfViewer.loadError') || 'Failed to load PDF'}</Text>
        </View>
      ) : (
        <Pdf
          ref={pdfRef}
          source={{ uri: source, cache: false }}
          style={styles.pdf}
          trustAllCerts={false}
          enableDoubleTapZoom
          minScale={1}
          maxScale={4}
          onLoadComplete={(_pages, _path, _size, tableContents) => {
            setLoading(false);
            onOutline?.(flattenPdfOutline(tableContents));
          }}
          onPageChanged={handlePageChanged}
          onPageSingleTap={handleSingleTap}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
        />
      )}
      {pageBadge && !error && (
        <View style={styles.pageBadge} pointerEvents="none">
          <Text style={styles.pageBadgeText}>{pageBadge}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[100],
  },
  pdf: {
    flex: 1,
    backgroundColor: colors.gray[100],
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 12,
    textAlign: 'center',
  },
  pageBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pageBadgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
