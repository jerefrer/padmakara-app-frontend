import { getTrackTitle } from './i18n';

describe('getTrackTitle()', () => {
  it('returns the interface-language translation when present', () => {
    const track = { title: 'base', title_translations: { en: 'Hello', pt: 'Olá' } };
    expect(getTrackTitle(track, 'en')).toBe('Hello');
    expect(getTrackTitle(track, 'pt')).toBe('Olá');
  });

  it('falls back to title when no translation for the language', () => {
    expect(getTrackTitle({ title: 'base', title_translations: { en: 'Hello' } }, 'pt')).toBe('base');
  });

  it('falls back to title when title_translations is absent (split track)', () => {
    expect(getTrackTitle({ title: 'base' }, 'en')).toBe('base');
  });

  it('ignores empty / whitespace-only translations', () => {
    expect(getTrackTitle({ title: 'base', title_translations: { pt: '   ' } }, 'pt')).toBe('base');
  });
});
