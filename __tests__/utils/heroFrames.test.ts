import { eventPageFrameKey, homeFrameKey, pickFrameOverride } from '@/utils/heroFrames';

const o = { focalX: 30, focalY: 60, zoom: 2 };

describe('pickFrameOverride', () => {
  it('should return the override of the asked frame', () => {
    expect(pickFrameOverride({ page: o }, 'page')).toEqual(o);
  });

  it('should return null when that frame follows the focal point', () => {
    expect(pickFrameOverride({ page: o }, 'home')).toBeNull();
    expect(pickFrameOverride(null, 'page')).toBeNull();
    expect(pickFrameOverride(undefined, 'page')).toBeNull();
  });

  it('should return null for a malformed entry', () => {
    expect(pickFrameOverride({ page: { focalX: 'a', focalY: 1, zoom: 1 } as any }, 'page')).toBeNull();
  });

  it('should clamp values outside the stored ranges', () => {
    expect(pickFrameOverride({ page: { focalX: 130, focalY: -4, zoom: 9 } }, 'page')).toEqual({ focalX: 100, focalY: 0, zoom: 3 });
  });
});

describe('frame keys', () => {
  it.each([
    [{ isDesktop: false, shortScreen: false }, 'home'],
    [{ isDesktop: false, shortScreen: true }, 'home-short'],
    [{ isDesktop: true, shortScreen: false }, 'desk-home'],
  ])('should pick the home frame for %j', (layout, key) => {
    expect(homeFrameKey(layout)).toBe(key);
  });

  it('should use the desktop event frame only on web desktop', () => {
    expect(eventPageFrameKey(true)).toBe('desk-page');
    expect(eventPageFrameKey(false)).toBe('page');
  });
});
