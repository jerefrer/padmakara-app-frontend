import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface PDFViewerProps {
  source: string;
  onPageChange?: (page: number, totalPages: number) => void;
  compact?: boolean;
}

/**
 * Web: Use browser's native PDF viewer via iframe.
 * Provides built-in zoom, page navigation, search, and print.
 * Adds a custom fullscreen toggle button.
 */
export function PDFViewer({ source }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for fullscreen changes (user might press Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  return (
    // @ts-ignore - ref on View for web DOM access
    <View style={styles.container} ref={containerRef}>
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
        <>
          <iframe
            src={source}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              flex: 1,
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setError(true);
              setLoading(false);
            }}
            title="PDF Transcript"
          />
          {/* Fullscreen toggle — positioned over the PDF viewer's toolbar area */}
          {!loading && (
            <Pressable
              onPress={toggleFullscreen}
              style={styles.fullscreenButton}
              accessibilityRole="button"
              accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <Ionicons
                name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                size={16}
                color="rgba(255, 255, 255, 0.9)"
              />
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[100],
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
  fullscreenButton: {
    position: 'absolute',
    bottom: 12,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(50, 50, 50, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    // @ts-ignore - web shadow
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    cursor: 'pointer',
  },
});
