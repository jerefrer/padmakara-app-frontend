/**
 * Single source of truth for the responsive layout. Pure so the hook, the
 * image prefetch (which runs outside React) and the tests all agree.
 *
 * - Web: <768 mobile, 768-1024 "tablet" (still the desktop chrome, kept as
 *   it has always been), >=1025 desktop.
 * - iPhone: always mobile, whatever the width.
 * - iPad follows WIDTH, never orientation: <744 mobile (Split View, Slide
 *   Over), 744-1024 tablet (compact icon rail, one player, no right rail),
 *   >=1025 desktop (the web desktop layout).
 */

export type HeroVariantName = 'mobile' | 'desktop';

export interface LayoutInput {
  platform: string;
  isPad: boolean;
  width: number;
}

export interface Layout {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  showSidebar: boolean;
  showMasterDetail: boolean;
  sidebarWidth: number;
  playerBarHeight: number;
  /** Bottom tab bar + mini player instead of the sidebar shell. */
  showTabBar: boolean;
  /** Right brand/account rail. */
  showRightRail: boolean;
  /** 320pt related-events column on event pages. */
  showRelatedEvents: boolean;
  /** Icon-only left rail. */
  compactSidebar: boolean;
  /** The event page's own AudioPlayer (off whenever the shell's player bar is the player). */
  showInlinePlayer: boolean;
  heroVariant: HeroVariantName;
}

export const IPAD_TABLET_MIN_WIDTH = 744;
export const WEB_TABLET_MIN_WIDTH = 768;
export const DESKTOP_MIN_WIDTH = 1025;
export const COMPACT_SIDEBAR_WIDTH = 72;
export const FULL_SIDEBAR_WIDTH = 280;
export const PLAYER_BAR_HEIGHT = 80;

export function computeLayout({ platform, isPad, width }: LayoutInput): Layout {
  const isWeb = platform === 'web';
  const isIPad = platform === 'ios' && isPad;
  const adaptive = isWeb || isIPad;
  const tabletMin = isIPad ? IPAD_TABLET_MIN_WIDTH : WEB_TABLET_MIN_WIDTH;

  const isMobile = !adaptive || width < tabletMin;
  const isTablet = adaptive && width >= tabletMin && width < DESKTOP_MIN_WIDTH;
  const isDesktop = adaptive && width >= DESKTOP_MIN_WIDTH;
  const isWide = adaptive && width > 1440;
  const compactSidebar = isIPad && isTablet;
  const showSidebar = !isMobile;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    showSidebar,
    showMasterDetail: isDesktop,
    sidebarWidth: compactSidebar ? COMPACT_SIDEBAR_WIDTH : FULL_SIDEBAR_WIDTH,
    playerBarHeight: PLAYER_BAR_HEIGHT,
    showTabBar: isMobile,
    showRightRail: isDesktop || (isWeb && isTablet),
    showRelatedEvents: isDesktop || (isWeb && isTablet),
    compactSidebar,
    // Web keeps today's behaviour (inline player below 1025); on iPad the
    // shell's player bar is the only player whenever the shell is present.
    showInlinePlayer: isMobile || (isWeb && !isDesktop),
    heroVariant: isMobile ? 'mobile' : 'desktop',
  };
}
