/**
 * Stable cache keys for expo-image. We can't fall back to URL-based hashing
 * because the backend hands out fresh presigned S3 URLs on every API call,
 * so the URL changes between visits and the cache misses every time.
 *
 * Instead we derive a cacheKey from the resource's identity (abbreviation /
 * id) plus its `*UpdatedAt` timestamp when available. The timestamp gives
 * us automatic invalidation when the admin replaces the image; when it's
 * absent we still get a stable key so navigations within a session reuse
 * the cached bytes.
 */

interface TeacherLike {
  abbreviation?: string | null;
  id?: number | string;
  avatarUpdatedAt?: string | null;
  heroUpdatedAt?: string | null;
}

interface GroupLike {
  id?: number | string;
  abbreviation?: string | null;
  avatarUpdatedAt?: string | null;
  heroUpdatedAt?: string | null;
}

function teacherIdent(teacher: TeacherLike): string {
  return String(teacher.abbreviation ?? teacher.id ?? 'unknown');
}

function groupIdent(group: GroupLike): string {
  return String(group.id ?? group.abbreviation ?? 'unknown');
}

export function teacherAvatarCacheKey(teacher: TeacherLike): string {
  return `teacher-avatar-${teacherIdent(teacher)}-${teacher.avatarUpdatedAt ?? 'v0'}`;
}

/**
 * Hero variant — desktop (2400px) and mobile (1200px) need distinct cache
 * keys so expo-image doesn't serve one when the other was requested.
 */
export type HeroVariant = 'desktop' | 'mobile';

function variantSuffix(v: HeroVariant): string {
  return v === 'mobile' ? '-m' : '';
}

export function teacherHeroCacheKey(
  teacher: TeacherLike,
  variant: HeroVariant = 'desktop',
): string {
  return `teacher-hero${variantSuffix(variant)}-${teacherIdent(teacher)}-${teacher.heroUpdatedAt ?? 'v0'}`;
}

/**
 * The key for the teacher image shown in the home feed, which displays
 * `heroUrl || avatarUrl || photoUrl`. The key has to follow that choice: a
 * hero keyed as the avatar would share one disk-cache entry with the real
 * avatar, and whichever was stored first would show in both places.
 */
export function teacherFeedImageCacheKey(
  teacher: (TeacherLike & { heroUrl?: string | null }) | null | undefined,
): string | undefined {
  if (!teacher) return undefined;
  return teacher.heroUrl ? teacherHeroCacheKey(teacher, 'desktop') : teacherAvatarCacheKey(teacher);
}

export function groupAvatarCacheKey(group: GroupLike): string {
  return `group-avatar-${groupIdent(group)}-${group.avatarUpdatedAt ?? 'v0'}`;
}

export function groupHeroCacheKey(
  group: GroupLike,
  variant: HeroVariant = 'desktop',
): string {
  return `group-hero${variantSuffix(variant)}-${groupIdent(group)}-${group.heroUpdatedAt ?? 'v0'}`;
}

/**
 * Publication covers are presigned URLs re-signed on every API call; keyed on
 * the publication instead, a cover downloaded once keeps showing offline and
 * after the URL expires, and `updatedAt` refetches it when the admin edits.
 */
export function publicationCoverCacheKey(publication: { id: number | string; updatedAt?: string | null }): string {
  return `publication-cover-${publication.id}-${publication.updatedAt ?? 'v0'}`;
}
