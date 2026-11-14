/** One line of a PDF's table of contents, ready to list. */
export interface PdfOutlineItem {
  title: string;
  /** 1-based page number. */
  page: number;
  /** 0 for top-level entries, 1 for their children, and so on. */
  depth: number;
}

/**
 * Flattens react-native-pdf's `tableContents` (the PDF outline) into a list.
 *
 * Both platforms send `{ title, pageIdx, children }` trees with a 0-based
 * `pageIdx`, a string on iOS and a number on Android. Entries without a title
 * or a usable page are dropped; their children are kept.
 */
export function flattenPdfOutline(tableContents: unknown): PdfOutlineItem[] {
  const items: PdfOutlineItem[] = [];
  const walk = (nodes: unknown, depth: number) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const { title, pageIdx, children } = node as { title?: unknown; pageIdx?: unknown; children?: unknown };
      const label = typeof title === 'string' ? title.trim() : '';
      const index = typeof pageIdx === 'number' ? pageIdx : typeof pageIdx === 'string' && pageIdx.trim() !== '' ? Number(pageIdx) : NaN;
      if (label && Number.isInteger(index) && index >= 0) {
        items.push({ title: label, page: index + 1, depth });
      }
      walk(children, depth + 1);
    }
  };
  walk(tableContents, 0);
  return items;
}
