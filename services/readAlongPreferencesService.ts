import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  textSize: 'readAlong.textSize',
} as const;

/** Font sizes (px) for the read-along text, small to extra large. */
export const READ_ALONG_TEXT_SIZES = [21, 24, 27, 31, 36] as const;

/** Index of the default step (27px, roughly 30 characters per line on a phone). */
export const DEFAULT_TEXT_SIZE_INDEX = 2;

export const MAX_TEXT_SIZE_INDEX = READ_ALONG_TEXT_SIZES.length - 1;

/** Clamp any number (or garbage) to a valid step index. */
export function clampTextSizeIndex(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TEXT_SIZE_INDEX;
  return Math.min(MAX_TEXT_SIZE_INDEX, Math.max(0, Math.round(value)));
}

/** Font size and matching line height for a step index. */
export function getReadAlongTextMetrics(index: number): { fontSize: number; lineHeight: number } {
  const fontSize = READ_ALONG_TEXT_SIZES[clampTextSizeIndex(index)];
  return { fontSize, lineHeight: Math.round(fontSize * 1.5) };
}

/**
 * Persistent preferences for the read-along viewer:
 *   - textSize (default step 2) — index into READ_ALONG_TEXT_SIZES
 */
class ReadAlongPreferencesService {
  async getTextSizeIndex(): Promise<number> {
    const v = await AsyncStorage.getItem(KEYS.textSize);
    if (v === null) return DEFAULT_TEXT_SIZE_INDEX;
    return clampTextSizeIndex(parseInt(v, 10));
  }

  async setTextSizeIndex(index: number): Promise<void> {
    await AsyncStorage.setItem(KEYS.textSize, String(clampTextSizeIndex(index)));
  }
}

export const readAlongPreferencesService = new ReadAlongPreferencesService();
export default readAlongPreferencesService;
