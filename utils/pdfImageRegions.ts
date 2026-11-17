/**
 * Where a PDF page paints its images, so the Sepia and Night reading themes
 * can recolour the page (paper and text) while photos and thangkas keep their
 * true colours.
 *
 * The rectangles come from the page's pdf.js operator list: every image is
 * painted into the unit square of the current transformation matrix (CTM),
 * which is tracked through save/restore, transform, form XObjects and groups.
 * Results are fractions of the page (0..1, top-left origin), so they hold at
 * every zoom level.
 */

/** A 2D affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [number, number, number, number, number, number];

/** A rectangle as fractions of the page, origin at the top left. */
export interface PageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The pdf.js operator codes this module reads (a subset of pdfjs.OPS). */
export interface ImageOps {
  save: number;
  restore: number;
  transform: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
  beginGroup: number;
  endGroup: number;
  paintImageXObject: number;
  paintInlineImageXObject: number;
  paintImageXObjectRepeat: number;
}

/**
 * One image covering at least this share of the page makes it a scanned page:
 * its text is part of the image, so the whole page is themed like text.
 * Otherwise Night would leave scanned books white.
 */
export const SCANNED_PAGE_COVERAGE = 0.85;

/** Images smaller than this share of the page (bullets, ornaments) are themed like text. */
export const MIN_IMAGE_AREA = 0.002;

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 · m2: applies m2 first, then m1 (the order of canvas `transform`). */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** Bounding box of the unit square under a matrix, in that matrix's space. */
export function unitSquareBounds(m: Matrix): { x0: number; y0: number; x1: number; y1: number } {
  const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
  const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function isMatrix(value: unknown): value is Matrix {
  return Array.isArray(value) && value.length === 6 && value.every((n) => typeof n === 'number');
}

/**
 * Image rectangles of a page from its operator list.
 *
 * @param viewportTransform pdf.js `viewport.transform` of a scale-1 viewport
 *   (PDF user space to top-left CSS pixels)
 * @param width / height that viewport's size
 */
export function extractImageRects(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
  ops: ImageOps,
  viewportTransform: Matrix,
  width: number,
  height: number,
): PageRect[] {
  const rects: PageRect[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;

  const addUnitSquare = (m: Matrix) => {
    const b = unitSquareBounds(multiply(viewportTransform, m));
    const x0 = Math.max(0, b.x0 / width);
    const y0 = Math.max(0, b.y0 / height);
    const x1 = Math.min(1, b.x1 / width);
    const y1 = Math.min(1, b.y1 / height);
    if (x1 > x0 && y1 > y0) rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[] | null;
    switch (fn) {
      case ops.save:
        stack.push(ctm);
        break;
      case ops.restore:
        ctm = stack.pop() ?? IDENTITY;
        break;
      case ops.transform:
        if (args && args.length === 6 && args.every((n) => typeof n === 'number')) {
          ctm = multiply(ctm, args as Matrix);
        }
        break;
      case ops.paintFormXObjectBegin:
        stack.push(ctm);
        if (args && isMatrix(args[0])) ctm = multiply(ctm, args[0]);
        break;
      case ops.beginGroup: {
        stack.push(ctm);
        const group = args?.[0] as { matrix?: unknown } | undefined;
        if (group && isMatrix(group.matrix)) ctm = multiply(ctm, group.matrix);
        break;
      }
      case ops.paintFormXObjectEnd:
      case ops.endGroup:
        ctm = stack.pop() ?? IDENTITY;
        break;
      case ops.paintImageXObject:
      case ops.paintInlineImageXObject:
        addUnitSquare(ctm);
        break;
      case ops.paintImageXObjectRepeat: {
        // [objId, scaleX, scaleY, positions]: one copy per (x, y) pair.
        const [, scaleX, scaleY, positions] = (args ?? []) as [unknown, number, number, ArrayLike<number>];
        if (typeof scaleX !== 'number' || typeof scaleY !== 'number' || !positions) break;
        for (let p = 0; p + 1 < positions.length; p += 2) {
          addUnitSquare(multiply(ctm, [scaleX, 0, 0, scaleY, positions[p], positions[p + 1]]));
        }
        break;
      }
      default:
        // Image masks (stencils painted in the fill colour) are shapes or
        // glyphs, themed like text; every other operator draws no image.
        break;
    }
  }
  return rects;
}

/** True when one image covers so much of the page that the page is a scan. */
export function isScannedPage(rects: PageRect[], threshold = SCANNED_PAGE_COVERAGE): boolean {
  return rects.some((r) => r.w * r.h >= threshold);
}

/**
 * The rectangles whose original colours are put back over a themed page:
 * none on a scanned page, and never the tiny ones.
 */
export function imagesToKeep(rects: PageRect[]): PageRect[] {
  if (isScannedPage(rects)) return [];
  return rects.filter((r) => r.w * r.h >= MIN_IMAGE_AREA);
}

/**
 * Whether sampled pixels (RGBA) look like text rather than a picture: almost
 * no colour and mostly light paper. Such images are bitmaps of text or line
 * art (our publications set Tibetan script as JBIG2 bitmaps), and keeping
 * them would leave white boxes on a Night page, so they are themed.
 */
export function looksLikeText(rgba: ArrayLike<number>): boolean {
  let pixels = 0;
  let saturation = 0;
  let light = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 16) continue; // transparent: shows the page behind
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    saturation += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (0.299 * r + 0.587 * g + 0.114 * b > 200) light++;
    pixels++;
  }
  if (pixels === 0) return true;
  return saturation / pixels < 0.06 && light / pixels > 0.5;
}

/** Whether a pixel is blank paper: near white, or transparent. */
function isPaper(rgba: ArrayLike<number>, i: number): boolean {
  if (rgba[i + 3] < 16) return true;
  const r = rgba[i];
  const g = rgba[i + 1];
  const b = rgba[i + 2];
  return Math.min(r, g, b) > 235 && Math.max(r, g, b) - Math.min(r, g, b) < 20;
}

/**
 * The part of a sampled image (width × height RGBA) inside its blank paper
 * margins, as fractions of the image. A picture with a white border would
 * otherwise show as a white band on a Night page. Null when it is all paper.
 */
export function contentBounds(rgba: ArrayLike<number>, width: number, height: number): PageRect | null {
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isPaper(rgba, (y * width + x) * 4)) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return null;
  return { x: left / width, y: top / height, w: (right - left + 1) / width, h: (bottom - top + 1) / height };
}

/** A rectangle inside another, both as fractions (of the inner one's parent and of the outer). */
export function subRect(outer: PageRect, inner: PageRect): PageRect {
  return { x: outer.x + inner.x * outer.w, y: outer.y + inner.y * outer.h, w: inner.w * outer.w, h: inner.h * outer.h };
}

/**
 * Paper pages and designed pages. Reading themes recolour paper (white,
 * cream or the grey of a scan) and the text on it. A page designed in colour
 * (a cover, a back cover, a coloured divider, a full-page photo) keeps its
 * original look. The page's background is read from the ring along its edges,
 * where pages have margins, and decided by majority: a coloured header band
 * over a white body still leaves the ring mostly paper, so that page is
 * themed.
 */
/** Depth of the edge ring sampled, as a share of the page's width and height. */
export const PAGE_RING_DEPTH = 0.12;
/** A paper pixel is at least this light (luma, 0–255)… */
export const PAPER_MIN_LUMA = 190;
/** …and at most this colourful ((max − min channel) / 255). */
export const PAPER_MAX_SATURATION = 0.15;
/** Share of the ring that must be paper for the page to be themed. */
export const PAPER_MAJORITY = 0.6;

/**
 * Whether a sampled page (width × height RGBA, the whole page scaled down)
 * is printed on paper, so a reading theme applies to it.
 */
export function isPaperPage(rgba: ArrayLike<number>, width: number, height: number): boolean {
  const ringX = Math.max(1, Math.round(width * PAGE_RING_DEPTH));
  const ringY = Math.max(1, Math.round(height * PAGE_RING_DEPTH));
  let ring = 0;
  let paper = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inRing = x < ringX || y < ringY || x >= width - ringX || y >= height - ringY;
      if (!inRing) continue;
      const i = (y * width + x) * 4;
      ring++;
      if (rgba[i + 3] < 16) {
        paper++; // transparent: the white the page is drawn on
        continue;
      }
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      if (luma >= PAPER_MIN_LUMA && saturation <= PAPER_MAX_SATURATION) paper++;
    }
  }
  return ring === 0 || paper / ring >= PAPER_MAJORITY;
}
