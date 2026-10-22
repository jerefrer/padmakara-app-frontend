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
