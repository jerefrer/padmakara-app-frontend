import type { ImageSourcePropType } from 'react-native';

/**
 * The brand panel's logo on iOS and Android: PNG at @1x/@2x/@3x, the
 * platform picks the density. The web uses the vector (brandPanelLogo.web.ts).
 */
export const BRAND_PANEL_LOGO: ImageSourcePropType = require('@/assets/images/brand-panel-logo.png');
