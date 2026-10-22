import { groupThumbnailSource } from '../../utils/groupThumbnail';

describe('groupThumbnailSource', () => {
  it('should use the avatar uploaded in the admin when the group has one', () => {
    // André: "The thumbnail image of the retreats is not appearing" (Treino da Mente 1).
    const group = { id: '7', avatarUrl: 'https://cdn.example/avatar.webp', avatarUpdatedAt: '2026-10-01' };

    const source = groupThumbnailSource(group, null);

    expect(source).toEqual({
      uri: 'https://cdn.example/avatar.webp',
      cacheKey: 'group-avatar-7-2026-10-01',
    });
  });

  it('should prefer the uploaded avatar over the bundled picture', () => {
    const bundled = 42;
    const group = { id: '7', avatarUrl: 'https://cdn.example/avatar.webp' };

    expect(groupThumbnailSource(group, bundled)).not.toBe(bundled);
  });

  it('should fall back to the bundled picture when no avatar was uploaded', () => {
    const bundled = 42;

    expect(groupThumbnailSource({ id: '7', avatarUrl: null }, bundled)).toBe(bundled);
  });
});
