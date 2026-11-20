/**
 * Layout and zoom rules for the web PDF viewer, kept free of React and the DOM
 * so they can be tested on their own.
 *
 * The three view modes follow macOS Preview:
 * - continuous: every page stacked in one column, scrolled freely;
 * - single: one page at a time, turned page by page;
 * - two: two pages side by side, turned spread by spread. The cover stands
 *   alone first (Preview's "Two Pages" with "Book Mode"), so the left/right
 *   pages of a printed booklet face each other as they do in print.
 */

export type ViewMode = 'continuous' | 'single' | 'two';

/** A fit preset, or a free scale where 1 is the page's actual size. */
export type Zoom = { kind: 'fit-width' } | { kind: 'fit-page' } | { kind: 'scale'; scale: number };

export type FitPreset = 'fit-width' | 'fit-page';

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 5;

/** CSS pixels per PDF point at 100 %, as in pdf.js and Preview's "Actual Size". */
export const CSS_PX_PER_POINT = 96 / 72;

/** The steps the zoom buttons and Cmd +/- walk through. */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

export const VIEW_MODES: readonly ViewMode[] = ['continuous', 'single', 'two'];

/**
 * Reads a stored view mode. Values from the former layout setting ('single'
 * was a continuous column, 'spread' and 'spread-cover' two-page columns) are
 * read as the closest new mode; anything else gives continuous.
 */
export function parseViewMode(saved: string | null | undefined, legacyLayout?: string | null): ViewMode {
  if (saved === 'continuous' || saved === 'single' || saved === 'two') return saved;
  if (legacyLayout === 'spread' || legacyLayout === 'spread-cover') return 'two';
  return 'continuous';
}

/** Reads a stored fit preset; the former values were 'width' and 'height'. */
export function parseFitPreset(saved: string | null | undefined): FitPreset {
  if (saved === 'fit-width' || saved === 'width') return 'fit-width';
  return 'fit-page';
}

/**
 * Groups the pages into the rows the viewer shows: one page per row, except
 * in two-page mode where the cover stands alone and the rest go in pairs.
 */
export function buildSpreads(mode: ViewMode, numPages: number): number[][] {
  const spreads: number[][] = [];
  if (numPages <= 0) return spreads;
  if (mode !== 'two') {
    for (let page = 1; page <= numPages; page++) spreads.push([page]);
    return spreads;
  }
  spreads.push([1]);
  for (let page = 2; page <= numPages; page += 2) {
    spreads.push(page + 1 <= numPages ? [page, page + 1] : [page]);
  }
  return spreads;
}

/** Index of the spread that holds a page (the first or last spread when out of range). */
export function spreadIndexOfPage(spreads: number[][], page: number): number {
  if (spreads.length === 0) return 0;
  const index = spreads.findIndex((spread) => spread.includes(page));
  if (index >= 0) return index;
  return page < spreads[0][0] ? 0 : spreads.length - 1;
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** The next zoom step above (direction 1) or below (direction -1) the current scale. */
export function stepScale(current: number, direction: 1 | -1): number {
  const epsilon = 0.001;
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > current + epsilon) ?? MAX_SCALE;
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < current - epsilon) return ZOOM_STEPS[i];
  }
  return MIN_SCALE;
}

/**
 * Scale after one pinch event. A trackpad pinch reaches the browser as wheel
 * events with ctrlKey set (Chrome, Firefox) whose deltaY is negative when the
 * fingers spread; this is the factor pdf.js uses for them.
 */
export function pinchScale(current: number, deltaY: number): number {
  return clampScale(current * Math.exp(-deltaY / 100));
}

export interface PageSize {
  /** Page width in PDF points. */
  width: number;
  /** Page height in PDF points. */
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * The scale (1 = actual size) at which a spread fits the viewport: across its
 * width for fit-width, whole within the viewport for fit-page.
 */
export function fitScale(preset: FitPreset, spread: PageSize[], viewport: Viewport, gap: number): number {
  if (spread.length === 0 || viewport.width <= 0 || viewport.height <= 0) return 1;
  const widthPt = spread.reduce((sum, page) => sum + page.width, 0);
  const heightPt = Math.max(...spread.map((page) => page.height));
  const gaps = gap * (spread.length - 1);
  const byWidth = (viewport.width - gaps) / (widthPt * CSS_PX_PER_POINT);
  if (preset === 'fit-width') return byWidth;
  const byHeight = viewport.height / (heightPt * CSS_PX_PER_POINT);
  return Math.min(byWidth, byHeight);
}

/** The effective scale of a zoom for a spread of pages. */
export function resolveScale(zoom: Zoom, spread: PageSize[], viewport: Viewport, gap: number): number {
  if (zoom.kind === 'scale') return clampScale(zoom.scale);
  return clampScale(fitScale(zoom.kind, spread, viewport, gap));
}

/** Rendered width of a page in CSS pixels. */
export function pageWidthPx(page: PageSize, scale: number): number {
  return Math.max(1, Math.round(page.width * CSS_PX_PER_POINT * scale));
}

/**
 * Most pixels one page canvas may have. Safari (iPad and iPhone) refuses larger
 * ones, and one such canvas is already 64 MB; a page past it is drawn a little
 * under the screen's resolution instead of not at all.
 */
export const MAX_CANVAS_PIXELS = 4096 * 4096;

/**
 * Canvas pixels per CSS pixel to draw a page of `cssWidth` x `cssHeight` at:
 * the screen's own pixel ratio (so text and Tibetan script are as sharp as in
 * Preview), lowered only when the canvas would pass `maxPixels`.
 */
export function renderPixelRatio(
  deviceRatio: number,
  cssWidth: number,
  cssHeight: number,
  maxPixels = MAX_CANVAS_PIXELS,
): number {
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const area = Math.max(1, cssWidth * cssHeight);
  const affordable = Math.sqrt(maxPixels / area);
  return Math.max(1, Math.min(ratio, affordable));
}

/**
 * Top offset of every row in a continuous column, plus the total height,
 * for rows of the given heights separated by `gap`.
 */
export function rowOffsets(heights: number[], gap: number): { offsets: number[]; total: number } {
  const offsets: number[] = [];
  let y = 0;
  for (const height of heights) {
    offsets.push(y);
    y += height + gap;
  }
  return { offsets, total: Math.max(0, y - gap) };
}

/**
 * The rows that intersect [scrollTop, scrollTop + viewportHeight], widened by
 * `overscan` rows on each side. Only those rows render their pages.
 */
export function visibleRows(
  offsets: number[],
  heights: number[],
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
): { first: number; last: number } {
  if (offsets.length === 0) return { first: 0, last: -1 };
  const bottom = scrollTop + viewportHeight;
  let first = offsets.length - 1;
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] + heights[i] >= scrollTop) {
      first = i;
      break;
    }
  }
  let last = first;
  while (last + 1 < offsets.length && offsets[last + 1] <= bottom) last++;
  return {
    first: Math.max(0, first - overscan),
    last: Math.min(offsets.length - 1, last + overscan),
  };
}

/** The row under the middle of the viewport: the page the reader is on. */
export function rowAtMiddle(offsets: number[], heights: number[], scrollTop: number, viewportHeight: number): number {
  if (offsets.length === 0) return 0;
  const middle = scrollTop + viewportHeight / 2;
  for (let i = 0; i < offsets.length; i++) {
    if (middle <= offsets[i] + heights[i]) return i;
  }
  return offsets.length - 1;
}

/**
 * Scroll position that keeps the document point under the pointer in place
 * when the content grows by `ratio` (pinch zoom around the cursor).
 */
export function anchoredScroll(scroll: number, pointer: number, ratio: number): number {
  return Math.max(0, (scroll + pointer) * ratio - pointer);
}

export type ViewerKeyAction = 'zoom-in' | 'zoom-out' | 'zoom-reset' | 'next' | 'previous' | 'first' | 'last';

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/**
 * What a key press does in the viewer, or null to leave it to the browser.
 * Cmd (Mac) or Ctrl with + / - / 0 zoom in every mode. Page keys turn pages
 * in single and two-page modes only; the continuous column scrolls natively.
 * Up/Down turn pages only when the page fits vertically (`canScrollVertically`
 * false), so a zoomed page can still be scrolled with them.
 */
export function viewerKeyAction(event: KeyLike, mode: ViewMode, canScrollVertically: boolean): ViewerKeyAction | null {
  const command = !!(event.metaKey || event.ctrlKey);
  if (command && !event.altKey) {
    if (event.key === '+' || event.key === '=') return 'zoom-in';
    if (event.key === '-' || event.key === '_') return 'zoom-out';
    if (event.key === '0') return 'zoom-reset';
    return null;
  }
  if (mode === 'continuous' || event.altKey || event.ctrlKey || event.metaKey) return null;
  switch (event.key) {
    case 'ArrowRight':
    case 'PageDown':
      return 'next';
    case 'ArrowLeft':
    case 'PageUp':
      return 'previous';
    case 'ArrowDown':
      return canScrollVertically ? null : 'next';
    case 'ArrowUp':
      return canScrollVertically ? null : 'previous';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return null;
  }
}

/**
 * Direction of a horizontal swipe in paged modes: a left swipe (dx < 0) turns
 * to the next page. Returns 0 when the movement is too short or mostly vertical.
 */
export function swipeDirection(dx: number, dy: number, threshold = 50): 1 | -1 | 0 {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * Rows of the continuous column whose pages stay mounted: the ones in view
 * (with overscan) plus the most recently shown ones, so scrolling back does
 * not redraw a page that was on screen a moment ago. Most recent last.
 */
export function keepRecentRows(previous: number[], first: number, last: number, max: number): number[] {
  const inView: number[] = [];
  for (let row = first; row <= last; row++) inView.push(row);
  const rest = previous.filter((row) => row < first || row > last);
  return [...rest, ...inView].slice(-Math.max(max, inView.length));
}

/**
 * Spreads mounted in single and two-page modes: the one shown, the one being
 * turned to, and its neighbours, drawn ahead so the next turn is instant.
 */
export function spreadsToRender(shown: number, target: number, count: number, prefetch = 1): number[] {
  const set = new Set<number>();
  const add = (index: number) => {
    if (index >= 0 && index < count) set.add(index);
  };
  add(shown);
  for (let d = -prefetch; d <= prefetch; d++) add(target + d);
  return [...set].sort((a, b) => a - b);
}

/**
 * Whether the viewer can swap to the target spread: every page of it has
 * been drawn (and themed) at its current width. Until then the spread on
 * screen stays, so turning a page never shows a blank sheet.
 */
export function spreadReady(pages: number[], drawnAt: ReadonlyMap<number, number>, widthOf: (page: number) => number): boolean {
  return pages.length > 0 && pages.every((page) => drawnAt.get(page) === widthOf(page));
}
