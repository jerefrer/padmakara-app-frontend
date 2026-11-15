import { mapEvent, mapEventImage } from '../../services/retreatService';

const apiImage = {
  avatarUrl: 'https://s3/avatar.webp',
  heroUrl: 'https://s3/hero.webp',
  heroMobileUrl: 'https://s3/hero-m.webp',
  heroFocalX: 20,
  heroFocalY: 70,
  heroScale: 100,
  heroFrameOverrides: { page: { focalX: 1, focalY: 2, zoom: 2 } },
  avatarUpdatedAt: '2026-02-01T00:00:00.000Z',
  heroUpdatedAt: '2026-02-02T00:00:00.000Z',
  artworkUrl: 'https://api/api/events/9/artwork.jpg?v=1',
};

describe('mapEventImage', () => {
  it('should keep the URLs, framing and timestamps of the API image', () => {
    expect(mapEventImage(apiImage)).toEqual(apiImage);
  });

  it('should default the framing when the API leaves it out', () => {
    expect(mapEventImage({ heroUrl: 'h' })).toMatchObject({ heroFocalX: 50, heroFocalY: 50, heroScale: 100, heroFrameOverrides: null });
  });

  it('should be null when the API sends no image, null, or one without pictures', () => {
    expect(mapEventImage(undefined)).toBeNull();
    expect(mapEventImage(null)).toBeNull();
    expect(mapEventImage({ heroUrl: null, heroMobileUrl: null, avatarUrl: null })).toBeNull();
  });
});

describe('mapEvent image', () => {
  it('should carry the event photo onto the Gathering', () => {
    expect(mapEvent({ id: 9, titleEn: 'Hong Kong', image: apiImage }).image).toEqual(apiImage);
  });

  it('should leave the photo null for an older cached payload without the field', () => {
    expect(mapEvent({ id: 9, titleEn: 'Hong Kong' }).image).toBeNull();
  });

  it('should keep photoTeacherId alongside the event photo', () => {
    expect(mapEvent({ id: 9, titleEn: 'x', photoTeacherId: 4, image: apiImage }).photoTeacherId).toBe(4);
  });
});
