/** The browser's Fullscreen API, with Safari's older prefixed names. */
interface FullscreenDocument {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void> | void;
  documentElement?: FullscreenElement;
}

interface FullscreenElement {
  requestFullscreen?: (options?: object) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const doc = (): FullscreenDocument | null =>
  typeof document === 'undefined' ? null : (document as unknown as FullscreenDocument);

/**
 * Whether the page can go fullscreen: false where the API is missing, such as
 * Safari on an iPhone, or blocked (an iframe without permission). The viewer
 * hides its fullscreen button then.
 */
export function canFullscreen(d: FullscreenDocument | null = doc()): boolean {
  if (!d) return false;
  const enabled = d.fullscreenEnabled ?? d.webkitFullscreenEnabled;
  if (enabled === false) return false;
  const el = d.documentElement;
  if (!el) return false;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

export function isFullscreen(d: FullscreenDocument | null = doc()): boolean {
  return !!(d?.fullscreenElement ?? d?.webkitFullscreenElement);
}

/** Enters fullscreen on `element` (the whole page by default). Rejects when the browser refuses. */
export async function enterFullscreen(element?: FullscreenElement | null): Promise<void> {
  const d = doc();
  const target = element ?? d?.documentElement;
  if (!target) return;
  if (target.requestFullscreen) await target.requestFullscreen();
  else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
}

export async function leaveFullscreen(): Promise<void> {
  const d = doc();
  if (!d) return;
  if (d.exitFullscreen) await d.exitFullscreen();
  else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
}
