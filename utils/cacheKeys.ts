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

export function teacherHeroCacheKey(teacher: TeacherLike): string {
  return `teacher-hero-${teacherIdent(teacher)}-${teacher.heroUpdatedAt ?? 'v0'}`;
}

export function groupAvatarCacheKey(group: GroupLike): string {
  return `group-avatar-${groupIdent(group)}-${group.avatarUpdatedAt ?? 'v0'}`;
}

export function groupHeroCacheKey(group: GroupLike): string {
  return `group-hero-${groupIdent(group)}-${group.heroUpdatedAt ?? 'v0'}`;
}
