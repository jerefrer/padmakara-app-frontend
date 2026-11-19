import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { flattenPdfOutline } from '@/utils/pdfOutline';
import type { PDFViewerHandle, PDFViewerProps } from './PDFViewer.types';

export type { PDFViewerHandle, PDFViewerProps } from './PDFViewer.types';

// A tap toggles the reader's bars at once. When it was on an internal link, the
// jump to a distant page follows within this window and the toggle is undone.
const LINK_JUMP_MS = 500;
const PAGE_BADGE_MS = 1500;

/**
 * iOS and Android: native PDF rendering through react-native-pdf (PDFKit on
 * iOS, PdfiumAndroid on Android). Internal links (a table of contents inside
 * the document) jump to their page natively. Web uses PDFViewer.web.tsx.
 * Requires a dev client or production build — not available in Expo Go.
 * Accepts file:// paths and https URLs.
 */
export const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(function PDFViewer(
  { source, onPageChange, onSingleTap, onOutline, contentInsetTop = 0, initialPage },
  ref
) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageBadge, setPageBadge] = useState<string | null>(null);
  const pdfRef = useRef<PdfRef>(null);
  // Fixed at mount: the native viewer applies `page` when the document loads.
  // Kept constant afterwards, so a later layout (rotation, bars hiding) never
  // replays it; see the iOS part of patches/react-native-pdf+7.0.5.patch.
  const [openPage] = useState(() => (initialPage && initialPage > 1 ? Math.floor(initialPage) : 1));
  const currentPage = useRef(openPage);
  const lastTap = useRef<{ at: number; page: number } | null>(null);
  const badgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    goToPage: (page: number) => pdfRef.current?.setPage(page),
  }));

  useEffect(
    () => () => {
      if (badgeTimer.current) clearTimeout(badgeTimer.current);
    },
    []
  );

  const handlePageChanged = useCallback(
    (page: number, totalPages: number) => {
      const tap = lastTap.current;
      if (tap && Date.now() - tap.at < LINK_JUMP_MS && Math.abs(page - tap.page) > 1) {
        lastTap.current = null;
        onSingleTap?.();
      }
      currentPage.current = page;
      onPageChange?.(page, totalPages);
      setPageBadge(`${page} / ${totalPages}`);
      if (badgeTimer.current) clearTimeout(badgeTimer.current);
      badgeTimer.current = setTimeout(() => setPageBadge(null), PAGE_BADGE_MS);
    },
    [onPageChange, onSingleTap]
  );

  const handleSingleTap = useCallback(() => {
    if (!onSingleTap) return;
    lastTap.current = { at: Date.now(), page: currentPage.current };
    onSingleTap();
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
          // Pinch still zooms. With double tap off, the patched viewer reports
          // a tap at once instead of waiting to rule out a second one.
          enableDoubleTapZoom={false}
          minScale={1}
          maxScale={4}
          // The native prop is an integer.
          contentInsetTop={Math.round(contentInsetTop)}
          page={openPage}
          onLoadComplete={(pages, _path, _size, tableContents) => {
            setLoading(false);
            // A shorter file than when the page was saved: its last page.
            if (openPage > pages) pdfRef.current?.setPage(pages);
            onOutline?.(flattenPdfOutline(tableContents, pages));
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
