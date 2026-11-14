import type { PdfOutlineItem } from '@/utils/pdfOutline';

export interface PDFViewerProps {
  source: string;
  title?: string;
  onPageChange?: (page: number, totalPages: number) => void;
  compact?: boolean;
  /** A tap on the page that did not follow a link (iOS and Android). */
  onSingleTap?: () => void;
  /** The document's table of contents, once loaded; empty when it has none (iOS and Android). */
  onOutline?: (items: PdfOutlineItem[]) => void;
}

export interface PDFViewerHandle {
  /** Scrolls to a 1-based page. */
  goToPage: (page: number) => void;
}
