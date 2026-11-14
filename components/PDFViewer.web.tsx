import React, { Suspense, forwardRef, lazy } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

import type { PDFViewerHandle, PDFViewerProps } from './PDFViewer.types';

export type { PDFViewerHandle, PDFViewerProps } from './PDFViewer.types';

// react-pdf / pdfjs-dist require browser globals (DOMMatrix, window) that don't
// exist during Expo Router's static render. Lazy-load so the import only
// evaluates in the browser.
const LazyImpl = lazy(() => import('./PDFViewerWebImpl'));

// The web viewer has its own toolbar (layouts, fit, fullscreen); the reader
// extras of the native viewer (tap, outline, goToPage) are not wired here.
export const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(function PDFViewer(
  { onSingleTap: _onSingleTap, onOutline: _onOutline, ...props },
  _ref
) {
  const { t } = useLanguage();
  if (typeof window === 'undefined') {
    return <View style={styles.placeholder} />;
  }
  return (
    <Suspense
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>{t('pdfViewer.loadingViewer') || 'Loading PDF viewer...'}</Text>
        </View>
      }
    >
      <LazyImpl {...props} />
    </Suspense>
  );
});

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 12,
  },
});
