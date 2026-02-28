/**
 * Shared color palette for the Padmakara app.
 *
 * Refined palette aligned with padmakara.pt website aesthetic:
 * white/near-white backgrounds, deep muted red accents, neutral grays.
 * This is the single source of truth for color values used across the application.
 */

export const colors = {
  cream: {
    50: '#ffffff',
    100: '#fefefe',
    200: '#f5f4f2',
    500: '#e8e6e3',
  },
  burgundy: {
    50: '#f8f1f1',
    100: '#f2e0e0',
    500: '#9b1b1b',
    600: '#7b1616',
    700: '#5a1111',
  },
  saffron: {
    50: '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2c2c2c',
  },
  green: {
    50: '#f0fdf4',
    500: '#10b981',
    600: '#059669',
  },
  white: '#ffffff',
};

/**
 * Legacy theme colors preserved from the Expo template.
 * Used by hooks/useThemeColor.ts (currently unused in the app).
 */
const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};
