/**
 * iOS ships Avenir itself, so nothing is embedded (see avenirFont.ts). The
 * PostScript name selects the Book weight the other platforms embed; the bare
 * family name "Avenir" would resolve to the heavier Roman.
 */
export const AVENIR_FAMILY = 'Avenir-Book';

export const avenirFontsToLoad: Record<string, number> = {};
