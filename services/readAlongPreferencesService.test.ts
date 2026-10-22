import AsyncStorage from '@react-native-async-storage/async-storage';
import service, {
  DEFAULT_TEXT_SIZE_INDEX,
  MAX_TEXT_SIZE_INDEX,
  READ_ALONG_TEXT_SIZES,
  clampTextSizeIndex,
  getReadAlongTextMetrics,
  nextTextSizeIndex,
} from './readAlongPreferencesService';

describe('readAlongPreferencesService', () => {
  it('should return the default step when nothing is stored', async () => {
    expect(await service.getTextSizeIndex()).toBe(DEFAULT_TEXT_SIZE_INDEX);
  });

  it('should return the saved step after saving', async () => {
    await service.setTextSizeIndex(4);
    expect(await service.getTextSizeIndex()).toBe(4);
  });

  it('should clamp out-of-range values when saving', async () => {
    await service.setTextSizeIndex(99);
    expect(await service.getTextSizeIndex()).toBe(MAX_TEXT_SIZE_INDEX);
    await service.setTextSizeIndex(-3);
    expect(await service.getTextSizeIndex()).toBe(0);
  });

  it('should fall back to the default when the stored value is corrupt', async () => {
    await AsyncStorage.setItem('readAlong.textSize.v2', 'abc');
    expect(await service.getTextSizeIndex()).toBe(DEFAULT_TEXT_SIZE_INDEX);
  });

  it('should ignore a step saved under the old 21-36px scale', async () => {
    await AsyncStorage.setItem('readAlong.textSize', '4');
    expect(await service.getTextSizeIndex()).toBe(DEFAULT_TEXT_SIZE_INDEX);
  });

  it('should default to 18px within the 16-26px range', () => {
    expect(READ_ALONG_TEXT_SIZES[DEFAULT_TEXT_SIZE_INDEX]).toBe(18);
    expect(READ_ALONG_TEXT_SIZES[0]).toBe(16);
    expect(READ_ALONG_TEXT_SIZES[MAX_TEXT_SIZE_INDEX]).toBe(26);
  });

  it('should advance one step and wrap after the largest', () => {
    expect(nextTextSizeIndex(0)).toBe(1);
    expect(nextTextSizeIndex(MAX_TEXT_SIZE_INDEX)).toBe(0);
  });

  it('should bound step indexes between 0 and the last step', () => {
    expect(clampTextSizeIndex(-1)).toBe(0);
    expect(clampTextSizeIndex(MAX_TEXT_SIZE_INDEX + 1)).toBe(MAX_TEXT_SIZE_INDEX);
    expect(clampTextSizeIndex(NaN)).toBe(DEFAULT_TEXT_SIZE_INDEX);
  });

  it('should scale line height with font size', () => {
    const small = getReadAlongTextMetrics(0);
    const large = getReadAlongTextMetrics(MAX_TEXT_SIZE_INDEX);
    expect(large.fontSize).toBeGreaterThan(small.fontSize);
    expect(large.lineHeight).toBeGreaterThan(small.lineHeight);
    expect(small.lineHeight).toBeGreaterThan(small.fontSize);
  });
});
