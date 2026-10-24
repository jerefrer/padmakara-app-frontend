/**
 * Per-frame hero framing set in the admin (`heroFrameOverrides` on teachers and retreat groups).
 * Frame keys are the admin's HERO_FRAMES keys; focal x/y are in % of the stored hero and zoom is
 * 1..3 (1 = plain cover fit). A layout without an entry follows the hero's own focal point.
 */
export type HeroFrameKey = 'home' | 'home-short' | 'page' | 'desk-home' | 'desk-page';

export interface HeroFrameOverride {
  focalX: number;
  focalY: number;
  zoom: number;
}

export type HeroFrameOverrides = Partial<Record<HeroFrameKey, HeroFrameOverride>>;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** The override of one layout, or null (follow the focal point) when absent or malformed. */
export function pickFrameOverride(
  overrides: HeroFrameOverrides | null | undefined,
  key: HeroFrameKey,
): HeroFrameOverride | null {
  const o = overrides?.[key];
  if (!o) return null;
  const { focalX, focalY, zoom } = o;
  if (![focalX, focalY, zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return { focalX: clamp(focalX, 0, 100), focalY: clamp(focalY, 0, 100), zoom: clamp(zoom, 1, 3) };
}

/** Home highlight card: the small-phone branch (window height < 750) and web desktop have their own frames. */
export function homeFrameKey(layout: { isDesktop: boolean; shortScreen: boolean }): HeroFrameKey {
  if (layout.isDesktop) return 'desk-home';
  return layout.shortScreen ? 'home-short' : 'home';
}

/** Event page: web desktop has its own, wider frame; phones and tablets share the 'page' frame. */
export function eventPageFrameKey(isDesktop: boolean): HeroFrameKey {
  return isDesktop ? 'desk-page' : 'page';
}
