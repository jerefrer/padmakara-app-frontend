/**
 * Avenir is an Apple system font. Android and the web do not have it, so the
 * app ships the file there. iOS must not: Apple rejects bundles that embed
 * its own fonts from October 2027 (ITMS-91198), and it already has Avenir —
 * see avenirFont.ios.ts, which Metro picks instead of this file for iOS, so
 * the .ttf never enters the iOS bundle.
 */
export const AVENIR_FAMILY = 'Avenir';

export const avenirFontsToLoad: Record<string, number> = {
  [AVENIR_FAMILY]: require('../assets/fonts/Avenir-Book.ttf'),
};
