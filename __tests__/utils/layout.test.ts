import { computeLayout } from '@/utils/layout';

const web = (width: number) => computeLayout({ platform: 'web', isPad: false, width });
const iphone = (width: number) => computeLayout({ platform: 'ios', isPad: false, width });
const ipad = (width: number) => computeLayout({ platform: 'ios', isPad: true, width });

describe('computeLayout — web (unchanged thresholds)', () => {
  it('should be mobile below 768', () => {
    const l = web(767);
    expect(l).toMatchObject({ isMobile: true, isTablet: false, isDesktop: false, showSidebar: false, showTabBar: true });
  });

  it('should keep desktop chrome with the wide sidebar between 768 and 1024', () => {
    const l = web(900);
    expect(l).toMatchObject({
      isMobile: false, isTablet: true, isDesktop: false, showSidebar: true,
      showTabBar: false, showRightRail: true, showRelatedEvents: true,
      compactSidebar: false, sidebarWidth: 280, showInlinePlayer: true,
    });
  });

  it('should be desktop from 1025 with no inline player', () => {
    const l = web(1025);
    expect(l).toMatchObject({ isDesktop: true, isTablet: false, showMasterDetail: true, showInlinePlayer: false, showRightRail: true });
  });

  it('should flag wide above 1440', () => {
    expect(web(1440).isWide).toBe(false);
    expect(web(1441).isWide).toBe(true);
  });
});

describe('computeLayout — iPhone', () => {
  it.each([320, 393, 430, 932, 1400])('should always be mobile at width %i', (w) => {
    const l = iphone(w);
    expect(l).toMatchObject({
      isMobile: true, isTablet: false, isDesktop: false, showSidebar: false,
      showTabBar: true, showRightRail: false, showRelatedEvents: false, showInlinePlayer: true,
      heroVariant: 'mobile',
    });
  });
});

describe('computeLayout — iPad', () => {
  it.each([375, 694, 743])('should be mobile in Split View width %i', (w) => {
    const l = ipad(w);
    expect(l).toMatchObject({ isMobile: true, showTabBar: true, showSidebar: false, showInlinePlayer: true, heroVariant: 'mobile' });
  });

  it.each([744, 768, 820, 834, 1024])('should be tablet at width %i', (w) => {
    const l = ipad(w);
    expect(l).toMatchObject({
      isMobile: false, isTablet: true, isDesktop: false, showSidebar: true,
      showTabBar: false, compactSidebar: true, sidebarWidth: 72,
      showRightRail: false, showRelatedEvents: false, showInlinePlayer: false,
      heroVariant: 'desktop',
    });
  });

  it.each([1025, 1032, 1180, 1366])('should be desktop at width %i', (w) => {
    const l = ipad(w);
    expect(l).toMatchObject({
      isMobile: false, isDesktop: true, showSidebar: true, showTabBar: false,
      compactSidebar: false, sidebarWidth: 280, showRightRail: true,
      showRelatedEvents: true, showInlinePlayer: false, heroVariant: 'desktop',
    });
  });
});
