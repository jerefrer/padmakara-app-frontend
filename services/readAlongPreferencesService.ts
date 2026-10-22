import AsyncStorage from '@react-native-async-storage/async-storage';

// The stored value is a step index, and the scale changed from 21-36px to
// 16-26px. A new key makes every device start from the new default instead of
// reading an old index (4 was 36px, now 26px) as a size it never chose.
const KEYS = {
  textSize: 'readAlong.textSize.v2',
} as const;

/** Font sizes (px) for the read-along text, small to extra large. */
export const READ_ALONG_TEXT_SIZES = [16, 18, 20, 23, 26] as const;

/** Index of the default step (18px, the body size of news sites on a phone). */
export const DEFAULT_TEXT_SIZE_INDEX = 1;

export const MAX_TEXT_SIZE_INDEX = READ_ALONG_TEXT_SIZES.length - 1;

/** Clamp any number (or garbage) to a valid step index. */
export function clampTextSizeIndex(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TEXT_SIZE_INDEX;
  return Math.min(MAX_TEXT_SIZE_INDEX, Math.max(0, Math.round(value)));
}

/** The step after `index`, wrapping from the largest back to the smallest. */
export function nextTextSizeIndex(index: number): number {
  return (clampTextSizeIndex(index) + 1) % READ_ALONG_TEXT_SIZES.length;
}

/** Font size and matching line height for a step index. */
export function getReadAlongTextMetrics(index: number): { fontSize: number; lineHeight: number } {
  const fontSize = READ_ALONG_TEXT_SIZES[clampTextSizeIndex(index)];
  return { fontSize, lineHeight: Math.round(fontSize * 1.5) };
}

/**
 * Persistent preferences for the read-along viewer:
 *   - textSize (default step 1) — index into READ_ALONG_TEXT_SIZES
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
