import type { ImageSourcePropType } from 'react-native';

/**
 * The brand panel's logo on the web: a vector, crisp at any pixel density.
 * Expo's web build serves only the @1x PNG, which Retina screens upscaled
 * into a blur. Drawn from André's logo-padmakara-branco-2026.eps (dark
 * background removed, one white path cropped to the artwork, same bounds as
 * the PNG), so size and placement are unchanged.
 */
export const BRAND_PANEL_LOGO: ImageSourcePropType = require('@/assets/images/brand-panel-logo.svg');
