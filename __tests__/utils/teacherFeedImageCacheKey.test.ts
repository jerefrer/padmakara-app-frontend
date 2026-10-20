import {
  teacherAvatarCacheKey,
  teacherFeedImageCacheKey,
  teacherHeroCacheKey,
} from '../../utils/cacheKeys';

describe('teacherFeedImageCacheKey', () => {
  const teacher = {
    abbreviation: 'KPS',
    heroUpdatedAt: '2026-08-01',
    avatarUpdatedAt: '2026-07-01',
  };

  it('should key a hero image as the desktop hero, the size heroUrl holds', () => {
    // The home feed shows heroUrl when there is one. Keying it as the avatar
    // made the hero and the avatar fight over one disk-cache entry.
    expect(teacherFeedImageCacheKey({ ...teacher, heroUrl: 'https://hero' })).toBe(
      teacherHeroCacheKey(teacher, 'desktop'),
    );
  });

  it('should key an avatar or photo as the avatar when there is no hero', () => {
    expect(teacherFeedImageCacheKey({ ...teacher, heroUrl: null })).toBe(
      teacherAvatarCacheKey(teacher),
    );
  });

  it('should have no key when there is no teacher', () => {
    expect(teacherFeedImageCacheKey(undefined)).toBeUndefined();
  });
});
