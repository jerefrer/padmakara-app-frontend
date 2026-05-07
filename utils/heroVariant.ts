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
