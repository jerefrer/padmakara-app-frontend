import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Pdf from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

interface PDFViewerProps {
  source: string;
  title?: string;
  onPageChange?: (page: number, totalPages: number) => void;
  compact?: boolean;
}

/**
 * Android: native PDF rendering through react-native-pdf.
 * Android WebView has no PDF renderer, so PDFViewer.tsx (WebView) cannot be used here.
 * Requires a dev client or production build — not available in Expo Go.
 * Accepts file:// paths and https URLs.
 */
export function PDFViewer({ source, onPageChange }: PDFViewerProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
          source={{ uri: source, cache: false }}
          style={styles.pdf}
          trustAllCerts={false}
          enableDoubleTapZoom
          minScale={1}
          maxScale={4}
          onLoadComplete={() => setLoading(false)}
          onPageChanged={(page, totalPages) => onPageChange?.(page, totalPages)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
        />
      )}
    </View>
  );
}

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
});
