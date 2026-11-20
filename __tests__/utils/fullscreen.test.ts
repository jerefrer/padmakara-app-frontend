import { canFullscreen, isFullscreen } from '@/utils/fullscreen';

const withApi = (extra = {}) => ({ documentElement: { requestFullscreen: () => Promise.resolve() }, ...extra });

describe('fullscreen support', () => {
  it('should be supported when the page can request fullscreen', () => {
    expect(canFullscreen(withApi({ fullscreenEnabled: true }) as any)).toBe(true);
  });

  it('should be supported through the prefixed API of older Safari', () => {
    expect(canFullscreen({ documentElement: { webkitRequestFullscreen: () => {} } } as any)).toBe(true);
  });

  it('should not be supported when the API is missing, as on Safari for iPhone', () => {
    expect(canFullscreen({ documentElement: {} } as any)).toBe(false);
  });

  it('should not be supported when the browser disables it for this page', () => {
    expect(canFullscreen(withApi({ fullscreenEnabled: false }) as any)).toBe(false);
  });

  it('should not be supported without a document', () => {
    expect(canFullscreen(null)).toBe(false);
  });

  it('should tell whether an element is fullscreen, prefixed or not', () => {
    expect(isFullscreen({ fullscreenElement: {} } as any)).toBe(true);
    expect(isFullscreen({ webkitFullscreenElement: {} } as any)).toBe(true);
    expect(isFullscreen({ fullscreenElement: null } as any)).toBe(false);
  });
});
