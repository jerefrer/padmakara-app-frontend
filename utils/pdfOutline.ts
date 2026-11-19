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
 * or a usable page are dropped; their children are kept. With `pageCount`, a
 * page outside the document also counts as unusable: iOS sends NSNotFound
 * for an entry that points to a page the PDF no longer has.
 */
export function flattenPdfOutline(tableContents: unknown, pageCount = Infinity): PdfOutlineItem[] {
  const items: PdfOutlineItem[] = [];
  const walk = (nodes: unknown, depth: number) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const { title, pageIdx, children } = node as { title?: unknown; pageIdx?: unknown; children?: unknown };
      const label = typeof title === 'string' ? title.trim() : '';
      const index = typeof pageIdx === 'number' ? pageIdx : typeof pageIdx === 'string' && pageIdx.trim() !== '' ? Number(pageIdx) : NaN;
      if (label && Number.isSafeInteger(index) && index >= 0 && index < pageCount) {
        items.push({ title: label, page: index + 1, depth });
      }
      walk(children, depth + 1);
    }
  };
  walk(tableContents, 0);
  return items;
}

/** The part of a pdf.js document (PDFDocumentProxy) the outline needs. */
export interface PdfJsOutlineSource {
  numPages: number;
  getOutline(): Promise<unknown>;
  getDestination(id: string): Promise<unknown>;
  getPageIndex(ref: unknown): Promise<number>;
}

/**
 * The web viewer's table of contents: pdf.js's outline, resolved to pages and
 * flattened like flattenPdfOutline. pdf.js gives each entry a destination,
 * named (a string to look up) or explicit (an array whose first item is a page
 * reference, or a 0-based page index). Entries without a title or a page
 * inside the document are dropped; their children are kept. Never throws: a
 * broken outline is an empty one.
 */
export async function resolvePdfJsOutline(pdf: PdfJsOutlineSource): Promise<PdfOutlineItem[]> {
  const pageOf = async (dest: unknown): Promise<number | null> => {
    try {
      const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
      if (!Array.isArray(explicit) || explicit.length === 0) return null;
      const target: unknown = explicit[0];
      const index =
        typeof target === 'number' ? target : target && typeof target === 'object' ? await pdf.getPageIndex(target) : NaN;
      return Number.isSafeInteger(index) && index >= 0 && index < pdf.numPages ? index + 1 : null;
    } catch {
      return null;
    }
  };

  const walk = async (nodes: unknown, depth: number): Promise<PdfOutlineItem[]> => {
    if (!Array.isArray(nodes)) return [];
    const levels = await Promise.all(
      nodes.map(async (node: unknown): Promise<PdfOutlineItem[]> => {
        if (!node || typeof node !== 'object') return [];
        const { title, dest, items } = node as { title?: unknown; dest?: unknown; items?: unknown };
        const label = typeof title === 'string' ? title.trim() : '';
        const [page, children] = await Promise.all([label ? pageOf(dest) : Promise.resolve(null), walk(items, depth + 1)]);
        return label && page !== null ? [{ title: label, page, depth }, ...children] : children;
      }),
    );
    return levels.flat();
  };

  try {
    return await walk(await pdf.getOutline(), 0);
  } catch {
    return [];
  }
}
