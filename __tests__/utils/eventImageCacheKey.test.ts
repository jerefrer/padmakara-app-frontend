import { eventAvatarCacheKey, eventHeroCacheKey } from '@/utils/cacheKeys';

describe('event image cache keys', () => {
  it('should change when the photo is replaced', () => {
    const before = eventHeroCacheKey({ id: 7 }, { heroUpdatedAt: '2026-01-01T00:00:00.000Z' });
    const after = eventHeroCacheKey({ id: 7 }, { heroUpdatedAt: '2026-02-01T00:00:00.000Z' });
    expect(before).not.toBe(after);
  });

  it('should keep the desktop, mobile and avatar images in separate buckets', () => {
    const image = { heroUpdatedAt: 'h', avatarUpdatedAt: 'h' };
    const keys = [
      eventHeroCacheKey({ id: 7 }, image, 'desktop'),
      eventHeroCacheKey({ id: 7 }, image, 'mobile'),
      eventAvatarCacheKey({ id: 7 }, image),
    ];
    expect(new Set(keys).size).toBe(3);
  });

  it('should differ between events', () => {
    expect(eventHeroCacheKey({ id: 1 }, {})).not.toBe(eventHeroCacheKey({ id: 2 }, {}));
  });
});
