import type { PdfOutlineItem } from '@/utils/pdfOutline';
import type { ReadingTheme } from '@/utils/pdfReadingTheme';

export interface PDFViewerProps {
  source: string;
  title?: string;
  onPageChange?: (page: number, totalPages: number) => void;
  compact?: boolean;
  /**
   * Web: show the download button in the viewer's toolbar (default true).
   * Screens with their own download button in the header turn it off.
   */
  showDownloadButton?: boolean;
  /** A tap on the page that did not follow a link (iOS and Android). */
  onSingleTap?: () => void;
  /** The document's table of contents, once loaded; empty when it has none (iOS and Android). */
  onOutline?: (items: PdfOutlineItem[]) => void;
  /**
   * Room above the first page for a bar laid over the document, in points: the
   * document opens below the bar and scrolls under it (iOS and Android).
   */
  contentInsetTop?: number;
  /**
   * The page to open on (1-based), e.g. where the reader left off. Read once,
   * when the viewer mounts: later values are ignored, so the reader is never
   * moved while reading. A page past the end opens the last page.
   */
  initialPage?: number | null;
  /**
   * Reading theme of the page (iOS and Android; default normal). The web viewer
   * has its own toolbar control and keeps its own setting.
   */
  readingTheme?: ReadingTheme;
}

export interface PDFViewerHandle {
  /** Scrolls to a 1-based page. */
  goToPage: (page: number) => void;
}
