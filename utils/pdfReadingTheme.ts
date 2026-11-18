import { colors } from '@/constants/colors';

/**
 * Reading themes of the web PDF viewer. The page canvases are recoloured
 * with CSS filters, so the text and link layers laid over them keep their
 * geometry: selection and link hit areas are unaffected.
 */
export type ReadingTheme = 'normal' | 'sepia' | 'night';

export const READING_THEMES: readonly ReadingTheme[] = ['normal', 'sepia', 'night'];

/** Reads a stored theme; anything else gives the normal theme. */
export function parseReadingTheme(saved: string | null | undefined): ReadingTheme {
  return saved === 'sepia' || saved === 'night' ? saved : 'normal';
}

/**
 * CSS filter for the page canvases.
 * - sepia: warm paper; a little extra contrast keeps the text crisp.
 * - night: a negative (invert) turned back by half a turn of hue, so that
 *   colours keep their hue (Padmakara red stays red, not cyan), as in the
 *   "smart invert" of macOS and iOS.
 */
export function pageFilter(theme: ReadingTheme): string | undefined {
  switch (theme) {
    case 'sepia':
      return 'sepia(0.45) brightness(0.97) contrast(1.06)';
    case 'night':
      return 'invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.95)';
    default:
      return undefined;
  }
}

/** Colours of the viewer around and under the pages for a theme. */
export function themeSurfaces(theme: ReadingTheme): { ground: string; paper: string } {
  switch (theme) {
    case 'sepia':
      return { ground: colors.reader.sepiaGround, paper: colors.reader.sepiaPaper };
    case 'night':
      return { ground: colors.reader.nightGround, paper: colors.reader.nightPaper };
    default:
      return { ground: colors.white, paper: colors.white };
  }
}

/** Attribute the viewer sets on its scrolling area to the current theme. */
export const READING_THEME_ATTRIBUTE = 'data-reading-theme';

/**
 * Attribute a page carries once its background is known: "paper" pages are
 * themed, "designed" pages (covers, coloured dividers, full-page photos) keep
 * their original colours. "pending" until then (canvas hidden).
 */
export const PAGE_TONE_ATTRIBUTE = 'data-page-tone';

/**
 * Style sheet that applies each theme's filter to the page canvases only:
 * the toolbar, the text layer (selection) and the link layer stay as they are.
 * A page found to be designed in colour is exempt (the more specific rule),
 * and a page whose tone is not known yet stays hidden on its themed paper.
 */
export function readingThemeCss(): string {
  return READING_THEMES.map((theme) => {
    const filter = pageFilter(theme);
    return filter
      ? `[${READING_THEME_ATTRIBUTE}="${theme}"] .react-pdf__Page__canvas { filter: ${filter}; }\n` +
          `[${READING_THEME_ATTRIBUTE}="${theme}"] [${PAGE_TONE_ATTRIBUTE}="designed"] .react-pdf__Page__canvas { filter: none; }\n` +
          `[${READING_THEME_ATTRIBUTE}="${theme}"] [${PAGE_TONE_ATTRIBUTE}="pending"] .react-pdf__Page__canvas { visibility: hidden; }`
      : '';
  })
    .filter(Boolean)
    .join('\n');
}
