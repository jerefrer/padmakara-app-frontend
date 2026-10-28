import { safeInternalPath } from '@/utils/safeInternalPath';

describe('safeInternalPath', () => {
  it.each(['/(tabs)', '/(tabs)/search', '/retreat/3?x=1#top'])('should keep the internal path %s', (p) => {
    expect(safeInternalPath(p)).toBe(p);
  });

  it.each([
    '//evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/\\evil.com',
    '/ok path',
    '/a\nb',
    'relative/path',
    '',
    undefined,
    ['/a'],
  ])('should fall back to home for %p', (p) => {
    expect(safeInternalPath(p)).toBe('/(tabs)');
  });
});
