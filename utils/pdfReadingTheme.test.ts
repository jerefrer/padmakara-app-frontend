import { nativeThemeLayers, parseReadingTheme } from './pdfReadingTheme';

describe('parseReadingTheme', () => {
  it('should return the normal theme when nothing valid is stored', () => {
    expect(parseReadingTheme(null)).toBe('normal');
    expect(parseReadingTheme('purple')).toBe('normal');
  });

  it('should return the stored theme when it is sepia or night', () => {
    expect(parseReadingTheme('sepia')).toBe('sepia');
    expect(parseReadingTheme('night')).toBe('night');
  });
});

describe('nativeThemeLayers', () => {
  it('should add no layer when the theme is normal', () => {
    expect(nativeThemeLayers('normal')).toEqual([]);
  });

  it('should multiply the page by the paper colour when the theme is sepia', () => {
    expect(nativeThemeLayers('sepia')).toEqual([{ color: '#f6eedb', blendMode: 'multiply' }]);
  });

  it('should start with a negative when the theme is night', () => {
    expect(nativeThemeLayers('night')[0]).toEqual({ color: '#ffffff', blendMode: 'difference' });
  });
});
