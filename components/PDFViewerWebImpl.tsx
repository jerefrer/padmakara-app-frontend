import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { colors } from '@/constants/colors';

// Configure PDF.js worker via CDN pinned to the installed version.
// Using a CDN keeps the Metro/Vite bundle slim and avoids worker setup in each
// target. jsdelivr serves the ES module build that react-pdf 10 expects.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  source: string;
  title?: string;
  onPageChange?: (page: number, totalPages: number) => void;
  compact?: boolean;
}

type Layout = 'single' | 'spread-cover' | 'spread';
type Fit = 'height' | 'width';

const LAYOUT_KEY = '@pdfViewer:layout';
const FIT_KEY = '@pdfViewer:fit';
const PAGE_GAP = 16;
const SIDE_PADDING = 24;
const TOOLBAR_HEIGHT = 40;

/**
 * Web PDF viewer powered by react-pdf/pdfjs-dist.
 * Offers single-page, two-page-with-cover, and two-page layouts, plus
 * fit-to-height and fit-to-width modes. User preferences persist in
 * localStorage. Annotations are disabled; text selection is kept.
 */
export default function PDFViewerWebImpl({ source, title, onPageChange }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(0.77); // width/height, default ~A4
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [currentPage, setCurrentPage] = useState(1);

  const [layout, setLayout] = useState<Layout>(() => {
    if (typeof window === 'undefined') return 'single';
    const saved = window.localStorage.getItem(LAYOUT_KEY) as Layout | null;
    return saved === 'single' || saved === 'spread' || saved === 'spread-cover'
      ? saved
      : 'single';
  });
  const [fit, setFit] = useState<Fit>(() => {
    if (typeof window === 'undefined') return 'height';
    const saved = window.localStorage.getItem(FIT_KEY) as Fit | null;
    return saved === 'width' || saved === 'height' ? saved : 'height';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(LAYOUT_KEY, layout);
  }, [layout]);
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(FIT_KEY, fit);
  }, [fit]);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
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

  const downloadName = useMemo(() => {
    if (title) return title.endsWith('.pdf') ? title : `${title}.pdf`;
    try {
      const pathname = new URL(source).pathname;
      const basename = decodeURIComponent(pathname.split('/').pop() || '');
      if (basename && basename !== '/') return basename.endsWith('.pdf') ? basename : `${basename}.pdf`;
    } catch { /* invalid URL, fall through */ }
    return 'document.pdf';
  }, [source, title]);

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(source);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [source, downloadName]);

  const file = useMemo(() => ({ url: source }), [source]);

  const onDocumentLoad = useCallback(
    async (pdf: any) => {
      setNumPages(pdf.numPages);
      try {
        const firstPage = await pdf.getPage(1);
        const vp = firstPage.getViewport({ scale: 1 });
        setAspectRatio(vp.width / vp.height);
      } catch {
        // Keep default aspect ratio
      }
    },
    [],
  );

  // User chooses the layout freely — no width-based lock.
  const effectiveLayout: Layout = layout;
  const pagesPerRow = effectiveLayout === 'single' ? 1 : 2;

  // Compute page render width
  const pageWidth = useMemo(() => {
    const availW = Math.max(0, containerSize.width - SIDE_PADDING * 2);
    const availH = Math.max(0, containerSize.height - TOOLBAR_HEIGHT - PAGE_GAP * 2);

    if (fit === 'width') {
      const gap = pagesPerRow > 1 ? PAGE_GAP : 0;
      return Math.max(120, Math.floor((availW - gap) / pagesPerRow));
    }
    // fit='height' — derive width from page aspect ratio so one page fits the viewport.
    return Math.max(120, Math.floor(availH * aspectRatio));
  }, [fit, pagesPerRow, containerSize, aspectRatio]);

  // Build the rows of pages based on layout.
  const rows = useMemo(() => {
    if (!numPages) return [] as number[][];
    const result: number[][] = [];
    if (effectiveLayout === 'single') {
      for (let i = 1; i <= numPages; i++) result.push([i]);
      return result;
    }
    if (effectiveLayout === 'spread-cover') {
      result.push([1]);
      for (let i = 2; i <= numPages; i += 2) {
        const pair = [i];
        if (i + 1 <= numPages) pair.push(i + 1);
        result.push(pair);
      }
      return result;
    }
    // spread
    for (let i = 1; i <= numPages; i += 2) {
      const pair = [i];
      if (i + 1 <= numPages) pair.push(i + 1);
      result.push(pair);
    }
    return result;
  }, [effectiveLayout, numPages]);

  // Track visible page via scroll
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !numPages) return;
    const onScroll = () => {
      const pageEls = Array.from(
        scroller.querySelectorAll<HTMLDivElement>('[data-page]'),
      );
      const mid = scroller.scrollTop + scroller.clientHeight / 2;
      for (const el of pageEls) {
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        if (mid >= top && mid <= bottom) {
          const p = parseInt(el.getAttribute('data-page') || '1', 10);
          setCurrentPage(p);
          onPageChange?.(p, numPages);
          return;
        }
      }
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [numPages, onPageChange]);

  const toolbarButton = (
    active: boolean,
    onPress: () => void,
    iconName: any,
    label: string,
    /** Optional rotation in degrees (used to mirror chevron icons for the
     *  fit-width variant — horizontal Ionicons equivalents don't exist). */
    rotate?: number,
  ) => (
    <Pressable
      onPress={onPress}
      style={[styles.toolbarButton, active && styles.toolbarButtonActive]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={iconName}
        size={16}
        color={active ? colors.burgundy[500] : colors.gray[600]}
        style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}
      />
    </Pressable>
  );

  return (
    // @ts-ignore - DOM ref on View for fullscreen target
    <View style={styles.container} ref={containerRef}>
      {/* Custom toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarGroup}>
          {toolbarButton(
            effectiveLayout === 'single',
            () => setLayout('single'),
            'document-outline',
            'Single page',
          )}
          {toolbarButton(
            effectiveLayout === 'spread',
            () => setLayout('spread'),
            'book-outline',
            'Two pages',
          )}
          {toolbarButton(
            effectiveLayout === 'spread-cover',
            () => setLayout('spread-cover'),
            'library-outline',
            'Two pages with cover',
          )}
        </View>
        <View style={styles.toolbarDivider} />
        <View style={styles.toolbarGroup}>
          {toolbarButton(
            fit === 'height',
            () => setFit('height'),
            'chevron-expand-outline',
            'Fit height',
          )}
          {toolbarButton(
            fit === 'width',
            () => setFit('width'),
            'chevron-expand-outline',
            'Fit width',
            90,
          )}
        </View>

        <View style={styles.toolbarSpacer} />

        {numPages ? (
          <Text style={styles.pageCounter}>
            {currentPage} / {numPages}
          </Text>
        ) : null}

        <View style={styles.toolbarGroup}>
          {toolbarButton(false, handleDownload, 'download-outline', 'Download PDF')}
          {toolbarButton(
            false,
            toggleFullscreen,
            isFullscreen ? 'contract-outline' : 'expand-outline',
            isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
          )}
        </View>
      </View>

      {/* Scrollable pages area */}
      {/* @ts-ignore - DOM ref */}
      <div ref={scrollRef} style={scrollerStyle}>
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.gray[400]} />
            <Text style={styles.errorText}>Failed to load PDF</Text>
          </View>
        ) : (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoad}
            onLoadError={() => setError(true)}
            loading={
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.burgundy[500]} />
                <Text style={styles.loadingText}>Loading PDF...</Text>
              </View>
            }
          >
            {rows.map((pair, rowIdx) => (
              <div key={rowIdx} style={rowStyle}>
                {pair.map((pageNumber) => (
                  <div
                    key={pageNumber}
                    data-page={pageNumber}
                    style={pageWrapperStyle}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                      loading={
                        <div
                          style={{
                            width: pageWidth,
                            height: pageWidth / aspectRatio,
                            backgroundColor: '#fafafa',
                          }}
                        />
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
          </Document>
        )}
      </div>
    </View>
  );
}

const scrollerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  backgroundColor: '#ffffff',
  padding: `${PAGE_GAP}px ${SIDE_PADDING}px`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: `${PAGE_GAP}px`,
  marginBottom: `${PAGE_GAP}px`,
};

const pageWrapperStyle: React.CSSProperties = {
  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  backgroundColor: '#ffffff',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    gap: 8,
  },
  toolbarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  toolbarDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: colors.gray[200],
    marginHorizontal: 4,
  },
  toolbarSpacer: {
    flex: 1,
  },
  toolbarButton: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore - web only
    cursor: 'pointer',
  },
  toolbarButtonActive: {
    backgroundColor: colors.burgundy[50],
  },
  pageCounter: {
    fontSize: 12,
    color: colors.gray[600],
    marginRight: 8,
    fontVariant: ['tabular-nums'],
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 12,
  },
  loadingOverlay: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 12,
    textAlign: 'center',
  },
});
