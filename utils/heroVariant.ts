import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import type { HeroVariant } from '@/utils/cacheKeys';

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
}

export interface EventHeroPick extends HeroSelection {
  owner: 'teacher' | 'group' | null;
  /** The entity the image comes from — focal point, scale and cache key must
   *  all be read from this same record. */
  record: EventHeroRecord | null;
}

/**
 * Hero for the event page. While listening people want to see the teacher, so
 * the first teacher's hero wins; the retreat group's hero is the fallback (the
 * group page already shows the group image).
 */
export function pickEventHero(
  event: { teachers?: EventHeroRecord[] | null; retreat_group?: EventHeroRecord | null } | null | undefined,
  isMobile: boolean,
): EventHeroPick {
  const teacher = event?.teachers?.[0] ?? null;
  const teacherPick = selectHero(teacher, isMobile);
  if (teacherPick.url) return { ...teacherPick, owner: 'teacher', record: teacher };
  const group = event?.retreat_group ?? null;
  const groupPick = selectHero(group, isMobile);
  if (groupPick.url) return { ...groupPick, owner: 'group', record: group };
  return { url: null, variant: 'desktop', owner: null, record: null };
}
