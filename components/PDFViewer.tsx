import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface PDFViewerProps {
  source: string;
  onPageChange?: (page: number, totalPages: number) => void;
  compact?: boolean;
}

/**
 * Native (iOS/Android): Use WebView to render PDF.
 * Works in Expo Go — no native module required.
 * iOS WebView has built-in PDF rendering with pinch-to-zoom.
 * For Android, uses Google Docs viewer as fallback.
 */
export function PDFViewer({ source }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.gray[400]} />
          <Text style={styles.errorText}>Failed to load PDF</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: source }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
          originWhitelist={['*']}
          javaScriptEnabled
          scalesPageToFit
          startInLoadingState={false}
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
  webview: {
    flex: 1,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
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
