export interface FocalCoverInput {
  frameWidth: number;
  frameHeight: number;
  imageWidth: number;
  imageHeight: number;
  /** Focal point as percent (0-100) of the stored image. */
  focalX: number;
  focalY: number;
}

const CENTER = { left: '50%', top: '50%' } as const;

const valid = (n: number) => Number.isFinite(n) && n > 0;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Object-position percent that puts the focal point at the frame centre, as far as the cover-fitted image allows. */
function axis(frame: number, displayed: number, focal: number): number {
  const overflow = displayed - frame;
  if (overflow <= 0.0001) return 50;
  const offset = clamp(frame / 2 - (clamp(focal, 0, 100) / 100) * displayed, -overflow, 0);
  return clamp((-offset / overflow) * 100, 0, 100);
}

/**
 * Converts a focal point into the `contentPosition` that keeps it centred in a
 * `contentFit="cover"` frame. CSS object-position semantics alone would put the
 * point at y% of the frame instead of at the centre.
 */
export function focalCoverPosition(input: FocalCoverInput): { left: string; top: string } {
  const { frameWidth, frameHeight, imageWidth, imageHeight, focalX, focalY } = input;
  if (![frameWidth, frameHeight, imageWidth, imageHeight].every(valid)) return { ...CENTER };

  const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const left = axis(frameWidth, imageWidth * scale, Number.isFinite(focalX) ? focalX : 50);
  const top = axis(frameHeight, imageHeight * scale, Number.isFinite(focalY) ? focalY : 50);
  return { left: `${left}%`, top: `${top}%` };
}

export interface FocalCoverPlacementInput extends FocalCoverInput {
  /** Per-frame zoom on top of the cover fit, 1..3; 1 = plain cover. */
  zoom?: number;
}

export interface FocalCoverPlacement {
  /** Rendered image size, in frame units. */
  width: number;
  height: number;
  /** Image offset relative to the frame's top-left corner (<= 0). */
  offsetX: number;
  offsetY: number;
}

/**
 * Where the image sits in the frame, as an offset and a size. Must stay identical to the admin's
 * focalCoverPosition (admin/src/utils/focalCover.ts in padmakara-api, same shared test cases):
 * the focal point is centred, clamped so the zoomed image still covers the frame.
 */
export function focalCoverPlacement(input: FocalCoverPlacementInput): FocalCoverPlacement {
  const { frameWidth, frameHeight, imageWidth, imageHeight, focalX, focalY } = input;
  if (![frameWidth, frameHeight, imageWidth, imageHeight].every(valid)) {
    return { width: frameWidth || 0, height: frameHeight || 0, offsetX: 0, offsetY: 0 };
  }
  const zoom = Number.isFinite(input.zoom) ? clamp(input.zoom as number, 1, 3) : 1;
  const s = Math.max(frameWidth / imageWidth, frameHeight / imageHeight) * zoom;
  const width = imageWidth * s;
  const height = imageHeight * s;
  const fx = clamp(Number.isFinite(focalX) ? focalX : 50, 0, 100);
  const fy = clamp(Number.isFinite(focalY) ? focalY : 50, 0, 100);
  return {
    width,
    height,
    offsetX: clamp(frameWidth / 2 - (fx / 100) * width, Math.min(0, frameWidth - width), 0),
    offsetY: clamp(frameHeight / 2 - (fy / 100) * height, Math.min(0, frameHeight - height), 0),
  };
}

/**
 * The same placement as a view transform, for an image view that is frame-sized and drawn with
 * contentFit="cover" and a centred contentPosition. The transform leaves the view's layout size
 * alone (so onLayout keeps reporting the frame); the frame must clip (overflow hidden).
 * Scale grows the cover image around the frame centre, the translation then moves the focal
 * point to the centre as far as the clamp allows.
 */
export function focalCoverTransform(input: FocalCoverPlacementInput): {
  scale: number;
  translateX: number;
  translateY: number;
} {
  const zoom = Number.isFinite(input.zoom) ? clamp(input.zoom as number, 1, 3) : 1;
  const p = focalCoverPlacement(input);
  return {
    scale: zoom,
    translateX: p.offsetX - (input.frameWidth - p.width) / 2,
    translateY: p.offsetY - (input.frameHeight - p.height) / 2,
  };
}
