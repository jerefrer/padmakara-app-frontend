import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import type { HeroVariant } from '@/utils/cacheKeys';
import type { HeroFrameOverrides } from '@/utils/heroFrames';

interface WithHero {
  heroUrl?: string | null;
  heroMobileUrl?: string | null;
}

export interface HeroSelection {
  url: string | null;
  /** Which variant was actually selected — pass this through to the matching
   *  cache key builder so expo-image doesn't reuse the desktop bytes for
   *  the mobile slot (or vice versa). */
  variant: HeroVariant;
}

/**
 * Picks the right hero variant URL for the given viewport. Phones get the
 * 1200px mobile WebP when it exists; tablets/desktops get the 2400px
 * desktop WebP. Records uploaded before the variant rollout only have
 * heroUrl, so fall back to that everywhere — better to over-serve than
 * to render nothing.
 */
export function selectHero(
  record: WithHero | null | undefined,
  isMobile: boolean,
): HeroSelection {
  if (!record) return { url: null, variant: 'desktop' };
  if (isMobile && record.heroMobileUrl) {
    return { url: record.heroMobileUrl, variant: 'mobile' };
  }
  return { url: record.heroUrl ?? null, variant: 'desktop' };
}

/** Convenience: just the URL when the caller doesn't need the variant tag. */
export function selectHeroUrl(
  record: WithHero | null | undefined,
  isMobile: boolean,
): string | null {
  return selectHero(record, isMobile).url;
}

/** Hook variant — reads viewport from `useDesktopLayout`. */
export function useHero(
  record: WithHero | null | undefined,
): HeroSelection {
  const { isMobile } = useDesktopLayout();
  return selectHero(record, isMobile);
}

/** Hook variant — URL only. */
export function useHeroUrl(
  record: WithHero | null | undefined,
): string | null {
  return useHero(record).url;
}

interface EventHeroRecord extends WithHero {
  heroScale?: number | null;
  heroFocalX?: number | null;
  heroFocalY?: number | null;
  heroFrameOverrides?: HeroFrameOverrides | null;
}

export interface EventHeroPick extends HeroSelection {
  owner: 'event' | 'teacher' | 'group' | null;
  /** The entity the image comes from — focal point, scale, frame overrides and cache key
   *  must all be read from this same record. */
  record: EventHeroRecord | null;
}

/** The event's own photo as the API sends it (`event.image`). */
export interface EventPhoto extends EventHeroRecord {
  avatarUrl?: string | null;
}

/**
 * The event's own photo when it has a usable picture, else null. It replaces the teachers'
 * photos (and the group's) everywhere the event is represented by a picture.
 */
export function pickEventPhoto<T extends EventPhoto>(
  event: { image?: T | null } | null | undefined,
): T | null {
  const image = event?.image;
  if (!image) return null;
  return image.heroUrl || image.heroMobileUrl || image.avatarUrl ? image : null;
}

interface PhotoTeacher extends WithHero {
  id?: number;
  avatarUrl?: string | null;
  photoUrl?: string | null;
}

/**
 * The teacher whose photo stands for an event: the API's `photoTeacherId` when it sent one,
 * else (cached payloads from before the field) the same choice made locally: the first
 * teacher with a hero, else the first with an avatar or photo. Used by the home highlight
 * and the event page so both show, and name, the same teacher.
 */
export function pickPhotoTeacher<T extends PhotoTeacher>(
  teachers: T[] | null | undefined,
  photoTeacherId?: number | null,
): T | null {
  const list = teachers ?? [];
  if (photoTeacherId != null) {
    const byId = list.find((t) => t.id === photoTeacherId);
    if (byId) return byId;
  }
  return (
    list.find((t) => t.heroUrl || t.heroMobileUrl) ??
    list.find((t) => t.avatarUrl || t.photoUrl) ??
    null
  );
}

/**
 * The teacher whose picture is the event's thumbnail in lists: the one the event page shows
 * (see pickPhotoTeacher), so tapping a face never opens a page about someone else. When that
 * teacher has no small picture, the first teacher who has one; else the first teacher.
 */
export function pickThumbTeacher<T extends PhotoTeacher>(
  teachers: T[] | null | undefined,
  photoTeacherId?: number | null,
): T | null {
  const list = teachers ?? [];
  const hasPicture = (t: T) => !!(t.avatarUrl || t.photoUrl);
  const photoTeacher = pickPhotoTeacher(list, photoTeacherId);
  if (photoTeacher && hasPicture(photoTeacher)) return photoTeacher;
  return list.find(hasPicture) ?? list[0] ?? null;
}

/**
 * Hero for the event page. The event's own photo (e.g. several teachers together) wins when it
 * has one. Otherwise, while listening people want to see the teacher, so the hero of the first
 * teacher who has a photo wins; the retreat group's hero is the fallback (the group page
 * already shows the group image).
 */
export function pickEventHero(
  event: {
    image?: EventPhoto | null;
    teachers?: Array<EventHeroRecord & PhotoTeacher> | null;
    photoTeacherId?: number | null;
    retreat_group?: EventHeroRecord | null;
  } | null | undefined,
  isMobile: boolean,
): EventHeroPick {
  const photo = pickEventPhoto(event);
  const photoPick = selectHero(photo, isMobile);
  if (photoPick.url) return { ...photoPick, owner: 'event', record: photo };
  const teacher = pickPhotoTeacher(event?.teachers, event?.photoTeacherId);
  const teacherPick = selectHero(teacher, isMobile);
  if (teacherPick.url) return { ...teacherPick, owner: 'teacher', record: teacher };
  const group = event?.retreat_group ?? null;
  const groupPick = selectHero(group, isMobile);
  if (groupPick.url) return { ...groupPick, owner: 'group', record: group };
  return { url: null, variant: 'desktop', owner: null, record: null };
}
