import { visibleSections, defaultSection, isSectionId } from '@/components/settings/sections';

const ids = (opts: { isWeb: boolean; isAuthenticated: boolean }) => visibleSections(opts).map((s) => s.id);

describe('visibleSections', () => {
  it('should show membership on the web to a signed-in user', () => {
    expect(ids({ isWeb: true, isAuthenticated: true })).toEqual([
      'profile', 'language', 'membership', 'retreats', 'storage', 'signin', 'about',
    ]);
  });

  it('should never show membership in the native app (reader-app rule)', () => {
    expect(ids({ isWeb: false, isAuthenticated: true })).not.toContain('membership');
  });

  it('should keep the access to retreats in the native app', () => {
    expect(ids({ isWeb: false, isAuthenticated: true })).toContain('retreats');
  });

  it('should only show what works without an account when signed out', () => {
    expect(ids({ isWeb: true, isAuthenticated: false })).toEqual(['language', 'about']);
  });

  it('should only show the video section in the native app, where the mobile-data switches live', () => {
    expect(ids({ isWeb: false, isAuthenticated: false })).toEqual(['language', 'video', 'about']);
    expect(ids({ isWeb: true, isAuthenticated: true })).not.toContain('video');
  });

  it('should put account sections before device sections and help last', () => {
    const groups = visibleSections({ isWeb: true, isAuthenticated: true }).map((s) => s.group);
    expect(groups).toEqual(['account', 'account', 'account', 'account', 'device', 'device', 'help']);
  });
});

describe('defaultSection', () => {
  it('should open the profile when signed in', () => {
    expect(defaultSection({ isWeb: true, isAuthenticated: true }, undefined)).toBe('profile');
  });

  it('should open the requested section when it is visible', () => {
    expect(defaultSection({ isWeb: true, isAuthenticated: true }, 'membership')).toBe('membership');
  });

  it('should fall back to the first visible section when the requested one is hidden', () => {
    expect(defaultSection({ isWeb: false, isAuthenticated: true }, 'membership')).toBe('profile');
    expect(defaultSection({ isWeb: true, isAuthenticated: false }, 'profile')).toBe('language');
  });
});

describe('isSectionId', () => {
  it('should reject unknown values', () => {
    expect(isSectionId('membership')).toBe(true);
    expect(isSectionId('billing')).toBe(false);
    expect(isSectionId(undefined)).toBe(false);
  });
});
