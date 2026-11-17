import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Page, pdfjs } from 'react-pdf';
import {
  contentBounds,
  extractImageRects,
  imagesToKeep,
  looksLikeText,
  subRect,
  type ImageOps,
  type Matrix,
  type PageRect,
} from '@/utils/pdfImageRegions';

/** The part of pdf.js's PDFPageProxy this file uses. */
interface PageProxy {
  getViewport: (params: { scale: number }) => { transform: number[]; width: number; height: number };
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
}

// Per page (pdf.js hands out one proxy per page and keeps it): the image
// rectangles, found once, and whether each one is a picture to keep. Both are
// independent of the zoom, so zooming only repeats the cheap pixel copy.
const rectCache = new WeakMap<PageProxy, Promise<PageRect[]>>();
/** Per image: the part to keep in true colours (page fractions), or null for text-like images. */
const verdictCache = new WeakMap<PageProxy, Map<number, PageRect | null>>();

function imageRects(page: PageProxy): Promise<PageRect[]> {
  let rects = rectCache.get(page);
  if (!rects) {
    rects = page
      .getOperatorList()
      .then(({ fnArray, argsArray }) => {
        const viewport = page.getViewport({ scale: 1 });
        return imagesToKeep(
          extractImageRects(
            fnArray,
            argsArray,
            pdfjs.OPS as unknown as ImageOps,
            viewport.transform as Matrix,
            viewport.width,
            viewport.height,
          ),
        );
      })
      .catch(() => []);
    rectCache.set(page, rects);
  }
  return rects;
}

/**
 * Largest side of the copy an image is examined at. Fine enough to find the
 * picture's edge within a pixel or two at any zoom (a coarser grid leaves a
 * seam of paper or of inverted picture), and done once per image.
 */
const MAX_SAMPLE_SIDE = 512;
let sampler: CanvasRenderingContext2D | null = null;

/**
 * The part of the image in `rect` to keep in true colours: the picture inside
 * its blank margins, or null when the image is text-like (themed instead).
 */
function pictureArea(source: HTMLCanvasElement, rect: PageRect): PageRect | null {
  const sx = rect.x * source.width;
  const sy = rect.y * source.height;
  const sw = Math.max(1, rect.w * source.width);
  const sh = Math.max(1, rect.h * source.height);
  const fit = Math.min(1, MAX_SAMPLE_SIDE / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * fit));
  const height = Math.max(1, Math.round(sh * fit));
  if (!sampler) {
    sampler = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  }
  if (!sampler) return rect;
  sampler.canvas.width = width;
  sampler.canvas.height = height;
  sampler.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  const pixels = sampler.getImageData(0, 0, width, height).data;
  if (looksLikeText(pixels)) return null;
  const content = contentBounds(pixels, width, height);
  return content ? subRect(rect, content) : null;
}

interface PdfThemedPageProps {
  pageNumber: number;
  width: number;
  loading: React.ReactNode;
  /**
   * The page is recoloured by a reading theme (a CSS filter on its canvas):
   * the pictures on it are then drawn again on top, from the canvas's own
   * unfiltered pixels, so they keep their true colours.
   */
  keepPictureColours: boolean;
}

/**
 * A react-pdf page that, under a reading theme, keeps photos and thangkas in
 * their own colours. The copies sit above the canvas and below nothing that
 * takes input (pointer-events: none), so selection and links still work.
 */
export function PdfThemedPage({ pageNumber, width, loading, keepPictureColours }: PdfThemedPageProps) {
  const [page, setPage] = useState<PageProxy | null>(null);
  const [renders, setRenders] = useState(0);
  const [rects, setRects] = useState<PageRect[]>([]);
  const layerRef = useRef<HTMLDivElement>(null);

  const onLoadSuccess = useCallback((proxy: PageProxy) => setPage(proxy), []);
  const onRenderSuccess = useCallback(() => setRenders((n) => n + 1), []);

  useEffect(() => {
    if (!keepPictureColours || !page) return;
    let cancelled = false;
    imageRects(page).then((found) => {
      if (!cancelled) setRects(found);
    });
    return () => {
      cancelled = true;
    };
  }, [keepPictureColours, page]);

  // Copy each picture's pixels from the freshly rendered canvas.
  useEffect(() => {
    const layer = layerRef.current;
    if (!keepPictureColours || !page || !layer || renders === 0) return;
    const source = layer.parentElement?.querySelector<HTMLCanvasElement>('canvas.react-pdf__Page__canvas');
    if (!source || !source.width) return;
    let verdicts = verdictCache.get(page);
    if (!verdicts) {
      verdicts = new Map();
      verdictCache.set(page, verdicts);
    }
    layer.querySelectorAll<HTMLCanvasElement>('canvas[data-image-index]').forEach((copy) => {
      const index = Number(copy.dataset.imageIndex);
      if (!rects[index]) return;
      if (!verdicts.has(index)) verdicts.set(index, pictureArea(source, rects[index]));
      const rect = verdicts.get(index);
      copy.dataset.checked = 'true';
      if (!rect) {
        copy.style.display = 'none';
        return;
      }
      const sx = rect.x * source.width;
      const sy = rect.y * source.height;
      const sw = Math.max(1, Math.round(rect.w * source.width));
      const sh = Math.max(1, Math.round(rect.h * source.height));
      copy.width = sw;
      copy.height = sh;
      copy.getContext('2d')?.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
      copy.style.left = `${rect.x * 100}%`;
      copy.style.top = `${rect.y * 100}%`;
      copy.style.width = `${rect.w * 100}%`;
      copy.style.height = `${rect.h * 100}%`;
      copy.style.display = 'block';
      copy.dataset.restored = 'true';
    });
  }, [keepPictureColours, page, rects, renders]);

  return (
    <>
      <Page
        pageNumber={pageNumber}
        width={width}
        renderAnnotationLayer={true}
        renderTextLayer={true}
        onLoadSuccess={onLoadSuccess as never}
        onRenderSuccess={onRenderSuccess}
        loading={loading}
      />
      {keepPictureColours && rects.length > 0 ? (
        <div ref={layerRef} style={layerStyle} data-image-restore-layer="">
          {rects.map((_, index) => (
            <canvas
              key={index}
              data-image-index={index}
              style={copyStyle}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

const layerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

const copyStyle: React.CSSProperties = {
  position: 'absolute',
  display: 'none',
};
