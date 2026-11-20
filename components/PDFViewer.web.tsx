import React, { Suspense, forwardRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { lazyWithReload } from '@/utils/lazyWithReload';

import type { PDFViewerHandle, PDFViewerProps } from './PDFViewer.types';

export type { PDFViewerHandle, PDFViewerProps } from './PDFViewer.types';

// react-pdf / pdfjs-dist require browser globals (DOMMatrix, window) that don't
// exist during Expo Router's static render. Lazy-load so the import only
// evaluates in the browser. A chunk missing after a deploy reloads the page once.
const LazyImpl = lazyWithReload(() => import('./PDFViewerWebImpl'));

// The web viewer has its own toolbar (layouts, fit, theme, fullscreen). A click
// on the page calls onSingleTap, so a reader screen can hide its bars as on a
// phone; the outline, goToPage and the initial page are wired.
export const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(function PDFViewer(
  props,
  ref
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
      <LazyImpl {...props} handleRef={ref} />
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
