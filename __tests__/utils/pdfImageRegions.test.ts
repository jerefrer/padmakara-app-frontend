import {
  MIN_IMAGE_AREA,
  PAGE_RING_DEPTH,
  PAPER_MAJORITY,
  PAPER_MAX_SATURATION,
  PAPER_MIN_LUMA,
  SCANNED_PAGE_COVERAGE,
  contentBounds,
  extractImageRects,
  imagesToKeep,
  isPaperPage,
  isScannedPage,
  looksLikeText,
  multiply,
  subRect,
  unitSquareBounds,
  type ImageOps,
  type Matrix,
} from '@/utils/pdfImageRegions';

const OPS: ImageOps = {
  save: 10,
  restore: 11,
  transform: 12,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  beginGroup: 76,
  endGroup: 77,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintImageXObjectRepeat: 88,
};
const PAINT_IMAGE_MASK = 83;

// An A4-ish page of 600 × 800 points; pdf.js's scale-1 viewport flips y.
const W = 600;
const H = 800;
const VIEWPORT: Matrix = [1, 0, 0, -1, 0, H];

const rects = (fn: number[], args: unknown[]) => extractImageRects(fn, args, OPS, VIEWPORT, W, H);

describe('matrix helpers', () => {
  it('should apply the second matrix first, like canvas transform', () => {
    const scale: Matrix = [2, 0, 0, 2, 0, 0];
    const move: Matrix = [1, 0, 0, 1, 10, 20];
    // move then scale: the offset is scaled too.
    expect(multiply(scale, move)).toEqual([2, 0, 0, 2, 20, 40]);
  });

  it('should bound the unit square under a rotation', () => {
    const quarterTurn: Matrix = [0, 1, -1, 0, 0, 0];
    expect(unitSquareBounds(quarterTurn)).toEqual({ x0: -1, y0: 0, x1: 0, y1: 1 });
  });
});

describe('extractImageRects', () => {
  it('should place an image from its cm matrix, top-left origin', () => {
    // 300 × 400 pt image whose bottom-left corner is at (150, 100).
    const found = rects([OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore], [null, [300, 0, 0, 400, 150, 100], ['img', 1, 1], null]);
    expect(found).toHaveLength(1);
    expect(found[0].x).toBeCloseTo(0.25);
    expect(found[0].y).toBeCloseTo(0.375); // top edge at y = 500 pt → (800 − 500) / 800
    expect(found[0].w).toBeCloseTo(0.5);
    expect(found[0].h).toBeCloseTo(0.5);
  });

  it('should undo a transform at restore', () => {
    const found = rects(
      [OPS.save, OPS.transform, OPS.restore, OPS.transform, OPS.paintImageXObject],
      [null, [10, 0, 0, 10, 0, 0], null, [60, 0, 0, 80, 0, 0], ['img']],
    );
    expect(found[0].w).toBeCloseTo(0.1);
    expect(found[0].h).toBeCloseTo(0.1);
  });

  it('should apply a form XObject matrix until the form ends', () => {
    const found = rects(
      [OPS.paintFormXObjectBegin, OPS.transform, OPS.paintImageXObject, OPS.paintFormXObjectEnd, OPS.transform, OPS.paintInlineImageXObject],
      [[[2, 0, 0, 2, 0, 0], [0, 0, 1, 1]], [60, 0, 0, 80, 0, 0], ['img'], null, [60, 0, 0, 80, 0, 0], [{}]],
    );
    expect(found[0].w).toBeCloseTo(0.2);
    expect(found[1].w).toBeCloseTo(0.1);
  });

  it('should clip images that bleed off the page', () => {
    const found = rects([OPS.transform, OPS.paintImageXObject], [[400, 0, 0, 100, 500, 750], ['img']]);
    expect(found[0].x + found[0].w).toBeCloseTo(1);
    expect(found[0].y).toBe(0);
  });

  it('should place every copy of a repeated image', () => {
    const found = rects([OPS.paintImageXObjectRepeat], [['img', 60, 80, [0, 0, 300, 400]]]);
    expect(found).toHaveLength(2);
    expect(found[1].x).toBeCloseTo(0.5);
  });

  it('should ignore image masks, which are glyphs or shapes in the fill colour', () => {
    expect(rects([OPS.transform, PAINT_IMAGE_MASK], [[300, 0, 0, 400, 0, 0], [{}]])).toEqual([]);
  });
});

describe('scanned pages', () => {
  it('should treat a page with one image over the coverage threshold as a scan', () => {
    expect(SCANNED_PAGE_COVERAGE).toBe(0.85);
    expect(isScannedPage([{ x: 0, y: 0, w: 1, h: 0.86 }])).toBe(true);
    expect(isScannedPage([{ x: 0, y: 0, w: 0.86, h: 0.86 }])).toBe(false); // 74 %, a large photo
  });

  it('should keep no image on a scanned page, so the whole page is themed', () => {
    expect(imagesToKeep([{ x: 0, y: 0, w: 1, h: 1 }, { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }])).toEqual([]);
  });

  it('should drop tiny images such as ornaments', () => {
    const tiny = { x: 0, y: 0, w: 0.01, h: 0.01 };
    const photo = { x: 0.2, y: 0.1, w: 0.6, h: 0.5 };
    expect(tiny.w * tiny.h).toBeLessThan(MIN_IMAGE_AREA);
    expect(imagesToKeep([tiny, photo])).toEqual([photo]);
  });
});

describe('looksLikeText', () => {
  const pixels = (colours: [number, number, number][]) => colours.flatMap(([r, g, b]) => [r, g, b, 255]);

  it('should see black script on white paper as text', () => {
    expect(looksLikeText(pixels([...Array(7).fill([255, 255, 255]), ...Array(3).fill([10, 10, 10])]))).toBe(true);
  });

  it('should see a colourful photo as a picture', () => {
    expect(looksLikeText(pixels([[200, 120, 30], [240, 200, 60], [90, 40, 10], [255, 255, 255]]))).toBe(false);
  });

  it('should see a dark grey photo as a picture, not text', () => {
    expect(looksLikeText(pixels(Array(10).fill([60, 60, 60])))).toBe(false);
  });

  it('should treat a fully transparent image as text-like (nothing to keep)', () => {
    expect(looksLikeText([0, 0, 0, 0, 255, 255, 255, 0])).toBe(true);
  });
});

describe('contentBounds', () => {
  const size = 4;
  const image = (dark: [number, number][]) => {
    const rgba: number[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isDark = dark.some(([dx, dy]) => dx === x && dy === y);
        rgba.push(...(isDark ? [120, 60, 20, 255] : [255, 255, 255, 255]));
      }
    }
    return rgba;
  };

  it('should trim the white margins around a picture', () => {
    expect(contentBounds(image([[1, 1], [2, 2]]), size, size)).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });

  it('should return null for a blank image', () => {
    expect(contentBounds(image([]), size, size)).toBeNull();
  });

  it('should map the trimmed part back onto the page', () => {
    expect(subRect({ x: 0.2, y: 0.1, w: 0.5, h: 0.4 }, { x: 0.5, y: 0.25, w: 0.5, h: 0.5 })).toEqual({
      x: 0.45,
      y: 0.2,
      w: 0.25,
      h: 0.2,
    });
  });
});

describe('isPaperPage', () => {
  type RGB = [number, number, number];
  const SIZE = 20;
  /** A page whose pixel colour is chosen by position. */
  const page = (colourAt: (x: number, y: number) => RGB) => {
    const rgba: number[] = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) rgba.push(...colourAt(x, y), 255);
    return rgba;
  };
  const inMiddle = (x: number, y: number, margin: number) =>
    x >= margin && y >= margin && x < SIZE - margin && y < SIZE - margin;

  it('should theme a white page of text', () => {
    expect(isPaperPage(page((x, y) => (inMiddle(x, y, 3) && y % 2 ? [20, 20, 20] : [255, 255, 255])), SIZE, SIZE)).toBe(true);
  });

  it('should theme a cream page', () => {
    expect(isPaperPage(page(() => [246, 238, 219]), SIZE, SIZE)).toBe(true);
  });

  it('should theme a scan on grey-ish paper', () => {
    expect(isPaperPage(page((x, y) => (inMiddle(x, y, 3) && x % 3 === 0 ? [60, 60, 60] : [214, 210, 202])), SIZE, SIZE)).toBe(true);
  });

  it('should leave a blue cover with white text as designed', () => {
    expect(isPaperPage(page((x, y) => (inMiddle(x, y, 6) ? [255, 255, 255] : [24, 52, 120])), SIZE, SIZE)).toBe(false);
  });

  it('should leave a full-page dark photo cover as designed', () => {
    expect(isPaperPage(page((x, y) => [(x * 13) % 90, (y * 7) % 60, 30]), SIZE, SIZE)).toBe(false);
  });

  it('should theme a page with a big photo inside white margins', () => {
    expect(isPaperPage(page((x, y) => (inMiddle(x, y, 3) ? [180, 110, 20] : [255, 255, 255])), SIZE, SIZE)).toBe(true);
  });

  it('should theme a page with a coloured header band over a white body (majority of the edge is paper)', () => {
    expect(isPaperPage(page((_, y) => (y < 3 ? [155, 27, 27] : [255, 255, 255])), SIZE, SIZE)).toBe(true);
  });

  it('should use named thresholds', () => {
    expect([PAGE_RING_DEPTH, PAPER_MIN_LUMA, PAPER_MAX_SATURATION, PAPER_MAJORITY]).toEqual([0.12, 190, 0.15, 0.6]);
  });
});
