import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ContinuousIcon } from './icons/ContinuousIcon';
import { SinglePageIcon } from './icons/SinglePageIcon';
import { SpreadIcon } from './icons/SpreadIcon';
import { FitWidthIcon } from './icons/FitWidthIcon';
import { FitHeightIcon } from './icons/FitHeightIcon';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { installReadableStreamAsyncIterator } from '@/utils/readableStreamAsyncIterator';
import {
  anchoredScroll,
  buildSpreads,
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  parseFitPreset,
  parseViewMode,
  pageWidthPx,
  pinchScale,
  resolveScale,
  rowAtMiddle,
  rowOffsets,
  spreadIndexOfPage,
  stepScale,
  swipeDirection,
  viewerKeyAction,
  visibleRows,
  type FitPreset,
  type PageSize,
  type ViewMode,
  type ViewerKeyAction,
  type Zoom,
} from '@/utils/pdfViewerLayout';

installReadableStreamAsyncIterator(typeof ReadableStream === 'undefined' ? undefined : ReadableStream.prototype);

// Configure PDF.js worker via CDN pinned to the installed version.
// Using a CDN keeps the Metro/Vite bundle slim and avoids worker setup in each
// target. jsdelivr serves the ES module build that react-pdf 10 expects. The
// legacy worker, like the legacy main build Metro swaps in (metro.config.js),
// also runs on older browsers.
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`;
pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/legacy/build/pdf.worker.min.mjs`;

// The decoders and font data pdf.js loads on demand, from the same pinned CDN.
// Without `wasmUrl` it silently drops JBIG2 images, which is how some of our
// publications store their Tibetan script (O Tesouro de Bênçãos showed only
// the vowel marks on the web).
export const PDF_DOCUMENT_OPTIONS = {
  wasmUrl: `${PDFJS_CDN}/wasm/`,
  cMapUrl: `${PDFJS_CDN}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${PDFJS_CDN}/standard_fonts/`,
  iccUrl: `${PDFJS_CDN}/iccs/`,
};

interface PDFViewerProps {
  source: string;
  title?: string;
  onPageChange?: (page: number, totalPages: number) => void;
  compact?: boolean;
}

/** External links open in a new tab that cannot reach back into the app. */
export const EXTERNAL_LINK_REL = 'noopener noreferrer';

const MODE_KEY = '@pdfViewer:viewMode';
/** The former layout setting, read once to carry a two-page choice over. */
const LEGACY_LAYOUT_KEY = '@pdfViewer:layout';
const FIT_KEY = '@pdfViewer:fit';
const PAGE_GAP = 16;
const SIDE_PADDING = 24;
/** Rows rendered above and below the visible ones in the continuous column. */
const OVERSCAN_ROWS = 2;
/** A4 in points, used until the document reports its own page sizes. */
const DEFAULT_PAGE: PageSize = { width: 595, height: 842 };
/** Accumulated wheel distance that turns a page in single and two-page modes. */
const WHEEL_TURN_DISTANCE = 120;
/** Quiet time after which a new wheel gesture may turn another page. */
const WHEEL_GESTURE_GAP_MS = 250;

/** localStorage can throw (private windows, blocked site data); settings are a convenience. */
function readSetting(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not persisted; the viewer still works.
  }
}

/** Safari's trackpad pinch: non-standard GestureEvent with a cumulative scale. */
interface GestureLikeEvent extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

interface ToolbarButtonProps {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToolbarButton({ label, onPress, active = false, disabled = false, children }: ToolbarButtonProps) {
  return (
    // The span carries the hover tooltip, which react-native-web's Pressable cannot.
    <span title={label} style={tooltipStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.toolbarButton, active && styles.toolbarButtonActive, disabled && styles.toolbarButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active, disabled }}
      >
        {children}
      </Pressable>
    </span>
  );
}

/**
 * Web PDF viewer powered by react-pdf/pdfjs-dist, modelled on macOS Preview:
 * a continuous column, single pages or two-page spreads (cover alone), zoom by
 * trackpad pinch, Ctrl/Cmd-wheel, Ctrl/Cmd +/-/0 and the toolbar, with
 * fit-width and fit-page presets. The view mode and the fit preset persist in
 * localStorage. The text layer keeps text selectable and the annotation layer
 * makes the PDF's links work: external ones open in a new tab, internal ones
 * (a table of contents) go to their page in whichever mode is shown.
 */
export default function PDFViewerWebImpl({ source, title, onPageChange }: PDFViewerProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrollerSize, setScrollerSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [mode, setMode] = useState<ViewMode>(() =>
    parseViewMode(readSetting(MODE_KEY), readSetting(LEGACY_LAYOUT_KEY)),
  );
  const [fitPreset, setFitPreset] = useState<FitPreset>(() => parseFitPreset(readSetting(FIT_KEY)));
  const [zoom, setZoom] = useState<Zoom>(() => ({ kind: fitPreset }));

  useEffect(() => writeSetting(MODE_KEY, mode), [mode]);
  useEffect(() => writeSetting(FIT_KEY, fitPreset), [fitPreset]);

  // Measure the scrolling area: fit presets size the pages against it.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setScrollerSize({ width: el.clientWidth, height: el.clientHeight });
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

  const onDocumentLoad = useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages);
    setCurrentPage(1);
    try {
      const pages = await Promise.all(
        Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1)),
      );
      setPageSizes(
        pages.map((page: any) => {
          const vp = page.getViewport({ scale: 1 });
          return { width: vp.width, height: vp.height };
        }),
      );
    } catch {
      // Keep the default page size
    }
  }, []);

  const total = numPages ?? 0;
  const sizeOf = useCallback((page: number) => pageSizes[page - 1] ?? pageSizes[0] ?? DEFAULT_PAGE, [pageSizes]);
  const spreads = useMemo(() => buildSpreads(mode, total), [mode, total]);
  const spreadIndex = spreadIndexOfPage(spreads, currentPage);
  const paged = mode !== 'continuous';

  // One scale for the whole document, fitted on its largest page, so pages
  // keep their relative sizes as in print (and a fit preset does not change
  // scale from one page to the next).
  const referenceSpread = useMemo(() => {
    const largest = pageSizes.length
      ? {
          width: Math.max(...pageSizes.map((p) => p.width)),
          height: Math.max(...pageSizes.map((p) => p.height)),
        }
      : DEFAULT_PAGE;
    return mode === 'two' ? [largest, largest] : [largest];
  }, [pageSizes, mode]);

  const viewport = useMemo(
    () => ({
      width: Math.max(0, scrollerSize.width - SIDE_PADDING * 2),
      height: Math.max(0, scrollerSize.height - PAGE_GAP * 2),
    }),
    [scrollerSize],
  );

  const scale = resolveScale(zoom, referenceSpread, viewport, PAGE_GAP);
  const scaleRef = useRef(scale);

  const pageBox = useCallback(
    (page: number) => {
      const size = sizeOf(page);
      const width = pageWidthPx(size, scale);
      return { width, height: Math.round((width * size.height) / size.width) };
    },
    [sizeOf, scale],
  );

  const rowHeights = useMemo(
    () => spreads.map((spread) => Math.max(...spread.map((page) => pageBox(page).height))),
    [spreads, pageBox],
  );
  const { offsets, total: columnHeight } = useMemo(() => rowOffsets(rowHeights, PAGE_GAP), [rowHeights]);

  // ── Zoom ────────────────────────────────────────────────────────────
  // Where the content should stay put when the scale changes: the pointer
  // for a pinch, the middle of the view otherwise.
  const zoomAnchor = useRef<{ x: number; y: number } | null>(null);
  // A page to bring into view after the next layout (mode change, page jump).
  const pendingPage = useRef<number | null>(null);

  const zoomTo = useCallback((next: Zoom, anchor?: { x: number; y: number }) => {
    zoomAnchor.current = anchor ?? null;
    setZoom(next);
  }, []);

  const zoomBy = useCallback(
    (direction: 1 | -1) => zoomTo({ kind: 'scale', scale: stepScale(scaleRef.current, direction) }),
    [zoomTo],
  );

  const applyFit = useCallback(
    (preset: FitPreset) => {
      setFitPreset(preset);
      zoomTo({ kind: preset });
    },
    [zoomTo],
  );

  const resetZoom = useCallback(() => zoomTo({ kind: fitPreset }), [zoomTo, fitPreset]);

  // Keep the anchored point in place as the content grows or shrinks.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const previous = scaleRef.current;
    scaleRef.current = scale;
    const anchor = zoomAnchor.current;
    zoomAnchor.current = null;
    if (!el || previous === scale || pendingPage.current !== null) return;
    const ratio = scale / previous;
    const x = anchor?.x ?? el.clientWidth / 2;
    const y = anchor?.y ?? el.clientHeight / 2;
    el.scrollLeft = anchoredScroll(el.scrollLeft, x, ratio);
    el.scrollTop = anchoredScroll(el.scrollTop, y, ratio);
  }, [scale]);

  // ── Navigation ──────────────────────────────────────────────────────
  const goToPage = useCallback(
    (page: number) => {
      if (!total) return;
      const target = Math.min(total, Math.max(1, page));
      pendingPage.current = target;
      setCurrentPage(target);
    },
    [total],
  );

  const turn = useCallback(
    (direction: 1 | -1) => {
      if (!spreads.length) return;
      const index = Math.min(spreads.length - 1, Math.max(0, spreadIndex + direction));
      goToPage(spreads[index][0]);
    },
    [spreads, spreadIndex, goToPage],
  );

  const changeMode = useCallback(
    (next: ViewMode) => {
      if (next === mode) return;
      pendingPage.current = currentPage;
      setMode(next);
    },
    [mode, currentPage],
  );

  // Bring the pending page into view once the new layout is in place.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const page = pendingPage.current;
    if (!el || page === null || !spreads.length) return;
    pendingPage.current = null;
    if (paged) {
      el.scrollTop = 0;
    } else {
      el.scrollTop = offsets[spreadIndexOfPage(spreads, page)] ?? 0;
      setScrollTop(el.scrollTop);
    }
  }, [paged, spreads, offsets, currentPage]);

  // Track the page under the middle of the view in the continuous column.
  // Read from the scroll event itself (not an effect on scrollTop) so a
  // stale position never overrides a page that was just jumped to.
  const columnRef = useRef({ spreads, offsets, rowHeights, height: viewport.height });
  useLayoutEffect(() => {
    columnRef.current = { spreads, offsets, rowHeights, height: viewport.height };
  }, [spreads, offsets, rowHeights, viewport.height]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || paged) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
        const column = columnRef.current;
        if (pendingPage.current !== null || !column.spreads.length) return;
        const row = rowAtMiddle(column.offsets, column.rowHeights, Math.max(0, el.scrollTop - PAGE_GAP), column.height);
        setCurrentPage(column.spreads[row][0]);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [paged]);

  useEffect(() => {
    if (total) onPageChange?.(currentPage, total);
  }, [currentPage, total, onPageChange]);

  // ── Input: pinch and wheel ──────────────────────────────────────────
  // Native listeners: React's wheel handler is passive and cannot stop the
  // browser from zooming the whole page.
  const turnRef = useRef(turn);
  const pagedRef = useRef(paged);
  useLayoutEffect(() => {
    turnRef.current = turn;
    pagedRef.current = paged;
  }, [turn, paged]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let gestureBase: number | null = null;
    let wheelDistance = 0;
    let wheelLocked = false;
    let lastWheel = 0;

    const pointerIn = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        // Trackpad pinch (Chrome, Firefox) or Ctrl + mouse wheel.
        e.preventDefault();
        if (gestureBase !== null) return; // Safari reports the same pinch as gesture events.
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomTo({ kind: 'scale', scale: pinchScale(scaleRef.current, delta) }, pointerIn(e.clientX, e.clientY));
        return;
      }
      if (!pagedRef.current || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      // Single and two-page modes: scrolling past the edge of the page turns
      // it, once per gesture (a trackpad fling keeps sending events).
      const now = e.timeStamp;
      const quiet = now - lastWheel > WHEEL_GESTURE_GAP_MS;
      lastWheel = now;
      if (wheelLocked) {
        if (!quiet) return;
        wheelLocked = false;
      }
      if (quiet) wheelDistance = 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      const atTop = el.scrollTop <= 0;
      if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) {
        wheelDistance = 0;
        return;
      }
      wheelDistance += e.deltaY;
      if (Math.abs(wheelDistance) >= WHEEL_TURN_DISTANCE) {
        turnRef.current(wheelDistance > 0 ? 1 : -1);
        wheelDistance = 0;
        wheelLocked = true;
      }
    };

    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureBase = scaleRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureLikeEvent;
      if (gestureBase === null || !Number.isFinite(g.scale)) return;
      zoomTo({ kind: 'scale', scale: clampScale(gestureBase * g.scale) }, pointerIn(g.clientX, g.clientY));
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      gestureBase = null;
    };

    // Swipe left/right turns pages on touch screens (iPad) when the page fits.
    let touchStart: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const start = touchStart;
      touchStart = null;
      if (!start || !pagedRef.current || e.changedTouches.length !== 1) return;
      if (el.scrollWidth > el.clientWidth + 1) return;
      const touch = e.changedTouches[0];
      const direction = swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
      if (direction) turnRef.current(direction);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('gestureend', onGestureEnd);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [zoomTo]);

  // ── Links ───────────────────────────────────────────────────────────
  // Internal links (a table of contents): pdf.js hands over the target page
  // and the viewer scrolls or turns to it. react-pdf keeps the onItemClick of
  // its first render, before the document had pages, so it gets a stable
  // function that calls the current goToPage.
  const goToPageRef = useRef(goToPage);
  useLayoutEffect(() => {
    goToPageRef.current = goToPage;
  }, [goToPage]);
  const followInternalLink = useCallback(({ pageNumber }: { pageNumber: number }) => {
    goToPageRef.current(pageNumber);
  }, []);

  // ── Input: keyboard ─────────────────────────────────────────────────
  const keyHandlers = useRef<Record<ViewerKeyAction, () => void> | null>(null);
  const modeRef = useRef(mode);
  useLayoutEffect(() => {
    modeRef.current = mode;
    keyHandlers.current = {
      'zoom-in': () => zoomBy(1),
      'zoom-out': () => zoomBy(-1),
      'zoom-reset': resetZoom,
      next: () => turn(1),
      previous: () => turn(-1),
      first: () => goToPage(1),
      last: () => goToPage(total),
    };
  }, [mode, zoomBy, resetZoom, turn, goToPage, total]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = scrollRef.current;
      // A viewer left mounted under another screen is not displayed.
      if (!el || el.getClientRects().length === 0) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const canScrollVertically = el.scrollHeight > el.clientHeight + 1;
      const action = viewerKeyAction(e, modeRef.current, canScrollVertically);
      const handlers = keyHandlers.current;
      if (!action || !handlers) return;
      // Capture phase + stopPropagation: the page keys win over the audio
      // shortcuts (arrows seek) while a document is being paged through.
      e.preventDefault();
      e.stopPropagation();
      handlers[action]();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  // ── Rendering ───────────────────────────────────────────────────────
  const visible = paged
    ? { first: spreadIndex, last: spreadIndex }
    : visibleRows(offsets, rowHeights, Math.max(0, scrollTop - PAGE_GAP), viewport.height, OVERSCAN_ROWS);

  const renderPage = (pageNumber: number, mounted: boolean) => {
    const box = pageBox(pageNumber);
    return (
      <div key={pageNumber} data-page={pageNumber} style={{ ...pageWrapperStyle, width: box.width, height: box.height }}>
        {mounted ? (
          <Page
            pageNumber={pageNumber}
            width={box.width}
            renderAnnotationLayer={true}
            renderTextLayer={true}
            loading={<div style={{ ...pagePlaceholderStyle, width: box.width, height: box.height }} />}
          />
        ) : null}
      </div>
    );
  };

  const renderRow = (rowIndex: number) => {
    const mounted = rowIndex >= visible.first && rowIndex <= visible.last;
    return (
      <div key={rowIndex} style={{ ...rowStyle, height: rowHeights[rowIndex], marginBottom: paged ? 0 : PAGE_GAP }}>
        {spreads[rowIndex].map((page) => renderPage(page, mounted))}
      </div>
    );
  };

  const pageLabel = useMemo(() => {
    if (!total || !spreads.length) return '';
    const spread = spreads[spreadIndex];
    const shown = spread.length > 1 ? `${spread[0]}–${spread[spread.length - 1]}` : String(spread[0]);
    return `${shown} / ${total}`;
  }, [spreads, spreadIndex, total]);

  const iconColor = (active: boolean) => (active ? colors.burgundy[500] : colors.gray[600]);
  const customIcon = (Icon: React.ComponentType<{ size?: number; color?: string }>, active: boolean) => (
    <Icon size={18} color={iconColor(active)} />
  );
  const ionIcon = (name: React.ComponentProps<typeof Ionicons>['name'], active = false) => (
    <Ionicons name={name} size={16} color={iconColor(active)} />
  );

  const zoomPercent = `${Math.round(scale * 100)}%`;
  const atFirst = spreadIndex <= 0;
  const atLast = spreadIndex >= spreads.length - 1;

  return (
    // @ts-ignore - DOM ref on View for fullscreen target
    <View style={styles.container} ref={containerRef}>
      {/* Custom toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarGroup}>
          <ToolbarButton
            label={t('pdfViewer.continuous') || 'Continuous scroll'}
            onPress={() => changeMode('continuous')}
            active={mode === 'continuous'}
          >
            {customIcon(ContinuousIcon, mode === 'continuous')}
          </ToolbarButton>
          <ToolbarButton
            label={t('pdfViewer.singlePage') || 'Single page'}
            onPress={() => changeMode('single')}
            active={mode === 'single'}
          >
            {customIcon(SinglePageIcon, mode === 'single')}
          </ToolbarButton>
          <ToolbarButton
            label={t('pdfViewer.twoPages') || 'Two pages'}
            onPress={() => changeMode('two')}
            active={mode === 'two'}
          >
            {customIcon(SpreadIcon, mode === 'two')}
          </ToolbarButton>
        </View>
        <View style={styles.toolbarDivider} />
        <View style={styles.toolbarGroup}>
          <ToolbarButton
            label={t('pdfViewer.fitWidth') || 'Fit width'}
            onPress={() => applyFit('fit-width')}
            active={zoom.kind === 'fit-width'}
          >
            {customIcon(FitWidthIcon, zoom.kind === 'fit-width')}
          </ToolbarButton>
          <ToolbarButton
            label={t('pdfViewer.fitPage') || 'Fit page'}
            onPress={() => applyFit('fit-page')}
            active={zoom.kind === 'fit-page'}
          >
            {customIcon(FitHeightIcon, zoom.kind === 'fit-page')}
          </ToolbarButton>
        </View>
        <View style={styles.toolbarDivider} />
        <View style={styles.toolbarGroup}>
          <ToolbarButton label={t('pdfViewer.zoomOut') || 'Zoom out'} onPress={() => zoomBy(-1)} disabled={scale <= MIN_SCALE}>
            {ionIcon('remove')}
          </ToolbarButton>
          <Text
            style={styles.zoomLevel}
            accessibilityLabel={t('pdfViewer.zoomLevel', { percent: zoomPercent }) || `Zoom ${zoomPercent}`}
          >
            {zoomPercent}
          </Text>
          <ToolbarButton label={t('pdfViewer.zoomIn') || 'Zoom in'} onPress={() => zoomBy(1)} disabled={scale >= MAX_SCALE}>
            {ionIcon('add')}
          </ToolbarButton>
        </View>

        <View style={styles.toolbarSpacer} />

        {total ? (
          <View style={styles.toolbarGroup}>
            <ToolbarButton
              label={t('pdfViewer.previousPage') || 'Previous page'}
              onPress={() => turn(-1)}
              disabled={atFirst}
            >
              {ionIcon('chevron-back')}
            </ToolbarButton>
            <Text style={styles.pageCounter}>{pageLabel}</Text>
            <ToolbarButton label={t('pdfViewer.nextPage') || 'Next page'} onPress={() => turn(1)} disabled={atLast}>
              {ionIcon('chevron-forward')}
            </ToolbarButton>
          </View>
        ) : null}

        <View style={styles.toolbarGroup}>
          <ToolbarButton label={t('transcript.downloadPdf') || 'Download PDF'} onPress={handleDownload}>
            {ionIcon('download-outline')}
          </ToolbarButton>
          <ToolbarButton
            label={
              isFullscreen
                ? t('pdfViewer.exitFullscreen') || 'Exit fullscreen'
                : t('pdfViewer.enterFullscreen') || 'Enter fullscreen'
            }
            onPress={toggleFullscreen}
          >
            {ionIcon(isFullscreen ? 'contract-outline' : 'expand-outline')}
          </ToolbarButton>
        </View>
      </View>

      {/* Pages area */}
      {/* @ts-ignore - DOM ref */}
      <div ref={scrollRef} style={scrollerStyle}>
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.gray[400]} />
            <Text style={styles.errorText}>{t('pdfViewer.loadError') || 'Failed to load PDF'}</Text>
          </View>
        ) : (
          <Document
            file={file}
            options={PDF_DOCUMENT_OPTIONS}
            onLoadSuccess={onDocumentLoad}
            onLoadError={() => setError(true)}
            onItemClick={followInternalLink}
            externalLinkTarget="_blank"
            externalLinkRel={EXTERNAL_LINK_REL}
            loading={
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.burgundy[500]} />
                <Text style={styles.loadingText}>{t('pdfViewer.loading') || 'Loading PDF...'}</Text>
              </View>
            }
          >
            {paged ? (
              spreads.length ? (
                <div style={{ ...pagedContentStyle, minHeight: viewport.height }}>{renderRow(spreadIndex)}</div>
              ) : null
            ) : (
              <div style={{ ...columnStyle, minHeight: columnHeight }}>{spreads.map((_, i) => renderRow(i))}</div>
            )}
          </Document>
        )}
      </div>
    </View>
  );
}

const scrollerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  backgroundColor: colors.white,
  padding: `${PAGE_GAP}px ${SIDE_PADDING}px`,
  // Pinch on touch screens stays with the browser; one-finger pans scroll.
  overscrollBehavior: 'contain',
};

// Content wider than the view (zoomed in) scrolls sideways instead of being
// clipped on the left, which a centred flex box would do.
const columnStyle: React.CSSProperties = {
  width: 'max-content',
  minWidth: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const pagedContentStyle: React.CSSProperties = {
  ...columnStyle,
  justifyContent: 'center',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'flex-start',
  gap: `${PAGE_GAP}px`,
  flexShrink: 0,
};

const pageWrapperStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  backgroundColor: colors.white,
  flexShrink: 0,
};

const pagePlaceholderStyle: React.CSSProperties = {
  backgroundColor: colors.cream[200],
};

const tooltipStyle: React.CSSProperties = {
  display: 'inline-flex',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 4,
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
  toolbarButtonDisabled: {
    opacity: 0.35,
    // @ts-ignore - web only
    cursor: 'default',
  },
  zoomLevel: {
    minWidth: 44,
    textAlign: 'center',
    fontSize: 12,
    color: colors.gray[600],
    fontVariant: ['tabular-nums'],
  },
  pageCounter: {
    minWidth: 56,
    textAlign: 'center',
    fontSize: 12,
    color: colors.gray[600],
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
