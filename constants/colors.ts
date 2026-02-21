/**
 * Shared color palette for the Padmakara app.
 *
 * Buddhist-inspired color scheme: warm cream backgrounds, burgundy accents,
 * saffron highlights, and neutral grays. This is the single source of truth
 * for color values used across the application.
 */

export const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
    200: '#f7f0e4',
    500: '#e8d8b7',
  },
  burgundy: {
    50: '#fef2f2',
    100: '#fde6e6',
    500: '#b91c1c',
    600: '#991b1b',
    700: '#7f1d1d',
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
    800: '#1f2937',
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
