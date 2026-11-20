import { colors } from '@/constants/colors';
import { pageFilter, parseReadingTheme, readingThemeCss, themeSurfaces } from '@/utils/pdfReadingTheme';

describe('parseReadingTheme', () => {
  it('should keep a stored theme', () => {
    expect(parseReadingTheme('sepia')).toBe('sepia');
    expect(parseReadingTheme('night')).toBe('night');
  });

  it('should default to normal when nothing valid is stored', () => {
    expect(parseReadingTheme(null)).toBe('normal');
    expect(parseReadingTheme('dark')).toBe('normal');
  });
});

describe('pageFilter', () => {
  it('should leave the pages untouched in the normal theme', () => {
    expect(pageFilter('normal')).toBeUndefined();
  });

  it('should warm the pages with a sepia filter', () => {
    expect(pageFilter('sepia')).toMatch(/^sepia\(/);
  });

  it('should invert the pages and turn the hue back so colours keep their hue at night', () => {
    expect(pageFilter('night')).toMatch(/^invert\(1\) hue-rotate\(180deg\)/);
  });
});

describe('readingThemeCss', () => {
  it('should filter only the page canvases, per theme', () => {
    const css = readingThemeCss();
    expect(css).toContain(`[data-reading-theme="sepia"] .react-pdf__Page__canvas { filter: ${pageFilter('sepia')}; }`);
    expect(css).toContain(`[data-reading-theme="night"] .react-pdf__Page__canvas { filter: ${pageFilter('night')}; }`);
    expect(css).not.toContain('"normal"');
    expect(css).not.toMatch(/textLayer|annotationLayer/);
  });

  it('should leave pages designed in colour (covers) unfiltered in every theme', () => {
    const css = readingThemeCss();
    expect(css).toContain('[data-reading-theme="night"] [data-page-tone="designed"] .react-pdf__Page__canvas { filter: none; }');
    expect(css).toContain('[data-reading-theme="sepia"] [data-page-tone="designed"] .react-pdf__Page__canvas { filter: none; }');
  });
});

describe('themeSurfaces', () => {
  it('should use the theme tokens for the ground around the pages', () => {
    expect(themeSurfaces('normal').ground).toBe(colors.cream[200]);
    expect(themeSurfaces('normal').paper).toBe(colors.white);
    expect(themeSurfaces('sepia').ground).toBe(colors.reader.sepiaGround);
    expect(themeSurfaces('night').ground).toBe(colors.reader.nightGround);
  });
});
