import React, { Suspense, lazy } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

interface PDFViewerProps {
  source: string;
  title?: string;
  onPageChange?: (page: number, totalPages: number) => void;
  compact?: boolean;
}

// react-pdf / pdfjs-dist require browser globals (DOMMatrix, window) that don't
// exist during Expo Router's static render. Lazy-load so the import only
// evaluates in the browser.
const LazyImpl = lazy(() => import('./PDFViewerWebImpl'));

export function PDFViewer(props: PDFViewerProps) {
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
}

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
