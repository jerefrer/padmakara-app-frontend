import { groupAvatarCacheKey } from '@/utils/cacheKeys';

interface GroupWithAvatar {
  id?: number | string;
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | null;
}

/**
 * The round picture of a retreat group: the avatar uploaded in the admin, else the picture
 * bundled with the app (matched from the group's name by the caller), else null.
 */
export function groupThumbnailSource<T>(
  group: GroupWithAvatar,
  bundled: T | null,
): { uri: string; cacheKey: string } | T | null {
  if (group.avatarUrl) {
    return { uri: group.avatarUrl, cacheKey: groupAvatarCacheKey(group) };
  }
  return bundled;
}
