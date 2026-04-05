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
 * Web: Use browser's native PDF viewer via iframe, but hide its dark toolbar
 * (#toolbar=0&navpanes=0) and overlay our own slim burgundy header with
 * download + fullscreen controls that match the app's design.
 */
export function PDFViewer({ source }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Append PDF Open Parameters to hide the native viewer chrome.
  // view=FitH fits the page width; Chrome/Edge/Firefox all honour these fragments.
  const iframeSrc = React.useMemo(() => {
    const separator = source.includes('#') ? '&' : '#';
    return `${source}${separator}toolbar=0&navpanes=0&scrollbar=0&view=FitV`;
  }, [source]);

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

  const handleDownload = useCallback(() => {
    // blob: URLs are same-origin, so a normal anchor click triggers download.
    const a = document.createElement('a');
    a.href = source;
    a.download = 'publication.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [source]);

  return (
    // @ts-ignore - ref on View for web DOM access
    <View style={styles.container} ref={containerRef}>
      {/* Custom slim toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarActions}>
          <Pressable
            onPress={handleDownload}
            style={styles.toolbarButton}
            accessibilityRole="button"
            accessibilityLabel="Download PDF"
          >
            <Ionicons name="download-outline" size={18} color={colors.gray[700]} />
          </Pressable>
          <Pressable
            onPress={toggleFullscreen}
            style={styles.toolbarButton}
            accessibilityRole="button"
            accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <Ionicons
              name={isFullscreen ? 'contract-outline' : 'expand-outline'}
              size={18}
              color={colors.gray[700]}
            />
          </Pressable>
        </View>
      </View>

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
        <iframe
          src={iframeSrc}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore - web-only
    cursor: 'pointer',
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
