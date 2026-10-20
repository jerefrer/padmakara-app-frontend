import { publicationCoverCacheKey } from '../../utils/cacheKeys';

describe('publicationCoverCacheKey', () => {
  it('should stay the same when only the presigned URL changes', () => {
    // The URL is re-signed on every API call; the key must not follow it,
    // or the disk cache misses every time and offline covers go grey.
    expect(publicationCoverCacheKey({ id: 4, updatedAt: '2026-08-01T10:00:00Z' })).toBe(
      publicationCoverCacheKey({ id: 4, updatedAt: '2026-08-01T10:00:00Z' }),
    );
  });

  it('should change when the publication is updated, so a replaced cover is fetched', () => {
    expect(publicationCoverCacheKey({ id: 4, updatedAt: '2026-08-01T10:00:00Z' })).not.toBe(
      publicationCoverCacheKey({ id: 4, updatedAt: '2026-09-01T10:00:00Z' }),
    );
  });
});
